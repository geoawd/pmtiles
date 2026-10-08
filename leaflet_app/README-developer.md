# Developer Notes — Geospatial Tabular Data Viewer

This document explains the internal architecture, key design decisions, and the reasoning behind non-obvious implementation choices. It is intended for developers maintaining or extending the application.

---

## Architecture overview

The application is a single-page static web app with no build step, no module bundler, and no framework. All logic lives in one JS file (`app_combined.js`), one CSS file (`app_combined.css`), and one HTML file per deployment (`index_combined.html`). The HTML file is the only thing that changes between deployments — it holds `APP_CONFIG` and references the shared JS and CSS.

This architecture was chosen deliberately:

- **Zero infrastructure** — runs from any static file server, no Node, no build pipeline, no CI required for a deployment change
- **Config-driven** — a non-developer can create a new deployment by copying an index file and editing the config block
- **Debuggable** — a single unminified JS file can be read and debugged directly in browser DevTools with no source maps needed

The trade-off is that the JS file grows as features are added. This is acceptable for the current scale. If it grows significantly larger, a bundler and module system would become worthwhile.

---

## State model

All mutable application state lives in a single `appState` object:

```js
const appState = {
    allData:             {},   // complete loaded data, never mutated
    filteredData:        {},   // geographic bounds snapshot — written only by applyBoundsFilter
    virtualRows:         {},   // sorted/filtered rows for the virtual table renderer
    searchState:         {},   // active text filter values, keyed by tab then column
    rangeState:          {},   // active range filter values, keyed by tab then column
    _rangeOperator:      {},   // range operator ('gte'/'lte') per tab per column — survives Clear All
    dropdownState:       {},   // active dropdown selections — Set per tab per column
    sortState:           {},   // active sort column and direction, keyed by tab
    layers:              [],   // Leaflet layer objects currently on the map
    geomCache:           Map,  // projected geometry, keyed by linkField value
    geomType:            null, // 'point' or 'polygon', detected from first record
    legendValues:        Set,  // unique colorField values, for categorical legend
    numericFieldCache:   {},   // Set of numeric column names, keyed by tab
    specialFilterIds:    {},   // Set of linkField values, keyed by tab (pre-computed)
    activeSpecialFilter: null, // key of the currently active special filter tab, or null
    clusterGroup:        null, // L.markerClusterGroup instance, or null
    _headerBuilt:        {},   // bool per tab — headers built exactly once
    _rafPending:         {},   // RAF throttle flag per tab for virtual scroll
    _filterDebounce:     null, // setTimeout handle for filter input debouncing
};
```

### Why `filteredData` is treated as a snapshot

`filteredData` is the output of `applyBoundsFilter` — it contains every record from every tab whose primary feature intersects the current map bounds. It is written **only** by `applyBoundsFilter` and read by everything else.

This separation is deliberate. It means the geographic scope and the column filters are cleanly separated: `filteredData` is the geographic scope, and `applySearchAndRange` operates on top of it. Neither contaminates the other. A column filter change never writes to `filteredData`; it only computes a derived view from it.

If `filteredData` were modified in place by column filters, clearing a column filter would require knowing what the original bounds-filtered set was — requiring either a re-fetch from `allData` (expensive) or a parallel unbounded copy (redundant). The current approach avoids both.

### Why `_rangeOperator` is separate from `rangeState`

`rangeState` holds the numeric threshold value for each active range filter. It is cleared by **Clear All Filters** and **Zoom to All**, which both call the shared `clearAllFilters()` helper.

`_rangeOperator` holds the `'gte'`/`'lte'` operator for each range column and is **not** cleared by either of those actions. The operator is a user preference for how the column should behave, not a filter value — resetting it on Clear All would be surprising. It persists until the user explicitly toggles it via the operator badge button, and it is serialised into the shared URL so links restore the correct operator.

---

## Filter pipeline

The filter pipeline has two entry points and a shared evaluation path.

### Entry point 1: `applyBoundsFilter`

Triggered by Leaflet's `moveend` event (pan or zoom). Rebuilds `filteredData` from `allData` using `isVisible()` against the new bounds, then calls `applyAllFilters(PRIMARY_TAB.key)`.

### Entry point 2: column filter inputs

Each filter input's `input` event calls `applyAllFilters(tab.key)` after a 180ms debounce.

### `applyAllFilters(tableType)`

This is where the two entry points converge. Regardless of which tab triggered it:

1. **Always computes `primaryBase` first** — `filteredData[PRIMARY_TAB.key]` with primary column filters applied. This is the authoritative scope.
2. If the triggering tab is primary, it renders itself immediately (it is already computed as `primaryBase`).
3. If the triggering tab is a sibling, it does **not** render itself here — rendering is deferred to Pass 2 in `updateMapAndTables` so that all active sibling filters are fully intersected first.
4. Calls `updateMapAndTables` passing `primaryBase` and `primaryIds`.

**Why siblings no longer render early in `applyAllFilters`**

An earlier version rendered the triggering sibling immediately in `applyAllFilters`, then skipped it in `updateMapAndTables` Pass 2 (marked as "already rendered"). The problem: the early render was narrowed only by `primaryIds`, not by the other siblings' active filters. A triggering sibling would display results that ignored other tabs' filters until something else triggered a re-render. Deferring all sibling rendering to Pass 2 ensures every sibling is always rendered from the fully-resolved intersection.

### `updateMapAndTables(sourceTableType, primaryBase, primaryIds)`

Receives the pre-computed `primaryBase` and `primaryIds` to avoid recomputation. Executes in two passes:

**Pass 1 — compute `intersectedIds`:** Starts from `primaryIds`. Iterates all sibling tabs in config order. For each sibling with active column filters, scopes its rows to the current `intersectedIds`, applies its column filters, and intersects the result back into `intersectedIds`. Siblings with no active filters do not narrow the intersection. After this pass, `intersectedIds` represents every primary location that passes all active filters on all tabs simultaneously.

**Pass 2 — render:** Renders all sibling tables from `intersectedIds`. Renders the primary table from `primaryBase` filtered to `intersectedIds`. Rebuilds map layers from the same set.

**Why the two-pass approach is necessary**

In a single-pass approach (render-as-you-go), a sibling tab that appears early in the config order gets rendered before tabs later in the order have had a chance to narrow `intersectedIds`. The result is that early siblings show a wider result set than the map — visible specifically when two or more sibling tabs have active filters simultaneously. The two-pass approach eliminates this ordering dependency entirely.

---

## Removed state and parameters

### `lastPrimaryFiltered` — removed

An earlier version cached the primary column-filtered rows in `appState.lastPrimaryFiltered`. This was used as the marker base in `updateMapAndTables`. It was removed because:

- It was only updated when the primary tab triggered `applyAllFilters`
- When a sibling triggered, `lastPrimaryFiltered` held stale data from the last primary-triggered run
- This caused markers to reflect an outdated primary filter state until the next pan

The fix was to eliminate the cached value entirely and always compute `primaryBase` fresh at the top of `applyAllFilters`.

### `displayData` parameter — removed

An earlier version passed the triggering tab's filtered rows as a `displayData` parameter to `updateMapAndTables`, which used it to seed `intersectedIds`. This was removed because:

- When a sibling with no active filters triggered, `displayData` contained only IDs present in the sibling dataset. Primary locations with no sibling rows would be silently dropped from `intersectedIds`, removing them from the map.
- The correct seed for `intersectedIds` is always `primaryIds` — the full set of in-bounds locations passing primary filters. Sibling filters narrow from there; a sibling with no filters does not narrow at all.

`updateMapAndTables` now takes only `primaryBase` and `primaryIds`.

---

## Geometry cache (`geomCache`)

All geometry is projected once at load time and stored in a `Map` keyed by `linkField` value. The cache stores typed entries:

```js
// Point
{ type: 'point', latLng: L.latLng }

// Polygon / multipolygon
{ type: 'polygon', rings: [[L.latLng, ...], ...], bounds: L.latLngBounds }
```

For polygons, the bounding box is pre-computed because `applyBoundsFilter` calls `isVisible()` on every primary record on every pan and zoom. If the bounds were computed on demand, it would require iterating all ring vertices on every pan event — O(vertices) per record per pan. Pre-computing bounds reduces this to a single `L.latLngBounds.intersects()` call per record.

### Why bounding box intersection rather than exact polygon intersection

Exact polygon-in-bounds testing would require point-in-polygon and line-intersection calculations per vertex. For the typical use case (administrative polygons, geological units, land parcels), bounding box intersection is a correct-enough approximation. A polygon whose bounding box intersects the viewport is almost certainly relevant to the user. The only false positives are large polygons that extend into the viewport at a corner — these are edge cases that don't affect correctness of the tables (the table shows rows for features the user can see or nearly see) and don't degrade the experience.

---

## Polygon colour generation

Polygons are coloured by hashing the `colorField` value string to an HSL hue:

```js
function stringToHue(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    return Math.abs(hash) % 360;
}
```

Saturation (65%) and lightness (40%) are fixed. This approach:

- Is stable — the same value always produces the same colour, across sessions and deployments
- Requires no configuration — colour assignments are automatic
- Produces visually distinct colours for strings that differ by more than a few characters
- Does not require knowing the set of values in advance

The trade-off is that two similar values (e.g. `'Active'` and `'Active '`) may produce similar hues, and there is no guarantee of perceptual distance between adjacent values. For categorical data with clearly distinct labels this is acceptable. If precise colour control is needed, a `colorMap` config option mapping values to explicit colours would be a straightforward extension.

---

## Virtual table renderer

The virtual table renders only the rows visible in the scroll viewport plus a configurable buffer (`VIRTUAL_BUFFER = 10` rows above and below). Two invisible spacer rows at the top and bottom of `<tbody>` maintain the correct scroll height.

On each scroll event, a `requestAnimationFrame` callback fires (throttled by `_rafPending` per tab) and calls `renderVirtualSlice`, which:

1. Calculates the first visible row index from `scrollTop / rowHeight`
2. Slices `virtualRows[tab]` to the visible window plus buffer
3. Clears existing rows from `<tbody>` (keeping the two spacers)
4. Builds and appends new `<tr>` elements
5. Updates spacer heights

`--row-height` in the CSS must match the actual rendered row height. If it drifts (e.g. due to padding changes), the virtual scroll position calculation becomes inaccurate, causing visible gaps or row repetition at scroll boundaries.

**Why not use a library for virtual scrolling?**

The app has no dependency on a component framework and adding a virtual scroll library would introduce a new dependency with its own update cadence. The implementation here is ~50 lines and completely tailored to the existing table structure. It handles the one meaningful complexity (scroll-triggered RAF rendering) without general-purpose overhead.

---

## URL state encoding

Filter state is serialised as JSON and base64-encoded into the URL hash. `history.replaceState` is used rather than `pushState` so that every filter interaction does not create a browser history entry. A user pressing back after filtering should return to the previous page, not cycle through filter states.

### Encoding

```js
btoa(unescape(encodeURIComponent(JSON.stringify(state))))
```

The `encodeURIComponent` → `unescape` → `btoa` chain handles Unicode characters in filter values correctly. Plain `btoa` on a string containing non-ASCII characters throws a `InvalidCharacterError`. The `encodeURIComponent` step percent-encodes Unicode code points; `unescape` converts those percent-encoded sequences into Latin-1 characters that `btoa` can safely encode.

### Validation (`isValidRestoredState`)

The decoded state is validated before any of it touches `appState`. Checks include:

- Tab keys in `search` and `range` must match known tab keys from `APP_CONFIG`
- Search values must be strings
- Range values must be finite numbers; operators must be `'gte'` or `'lte'`
- Map coordinates must be within valid WGS84 and zoom bounds
- The hash itself is rejected if it exceeds 10,000 characters

This prevents a crafted URL from writing unexpected types into `appState`. The validation is structural — it does not attempt to sanitise filter values, because filter values are only ever used as search strings against data, never injected into HTML.

### Map position restoration

Map position is restored before `initMap` runs by overwriting `APP_CONFIG.mapCenter` and `APP_CONFIG.mapZoom`. This means Leaflet initialises at the correct position and no `moveend` event fires during restoration. An earlier approach called `map.setView()` after initialisation, which triggered `moveend` → `applyBoundsFilter` before data was loaded — harmless but unnecessary.

---

## XSS prevention

An earlier version of `buildPopupContent` built popup HTML using string interpolation:

```js
// Old — vulnerable
container.innerHTML = `<a onclick="__zoomToId('${linkId}')">Zoom</a>`;
```

This was replaced with DOM construction:

```js
const a = document.createElement('a');
a.addEventListener('click', () => window.__zoomToId(linkId));
```

The `linkId` value is set as a JavaScript closure variable, never interpolated into an HTML string. This eliminates any XSS risk regardless of what characters appear in link field values.

All other dynamic content is set via `.textContent` (never `.innerHTML`) or as typed DOM properties (`.value`, `.href`, `.title`). The only use of `innerHTML` in the application is for static icon markup that contains no dynamic data.

---

## `fetch` error handling

Each JSON file fetch checks `response.ok` before parsing:

```js
if (!response.ok) throw new Error(`HTTP ${response.status} loading ${tab.file}`);
```

This surfaces missing or misnamed JSON files as a clear named error rather than a silent parse failure or empty dataset. The error message includes the HTTP status code and the filename, which is sufficient to diagnose the problem without opening the network panel.

---

## Header build guard (`_headerBuilt`)

Table headers are expensive to build — each column generates a `<th>` with a filter input, event listener, and ARIA attributes. An earlier version rebuilt headers on every call to `renderTable`, which was called from `applyBoundsFilter` → `plotLocations` on every pan.

The `_headerBuilt` flag per tab ensures each header is built exactly once at load time. Subsequent calls to `renderTableHeader` return immediately if the flag is set. This eliminates the per-pan DOM rebuild and the event listener leak that came with it.

---

## Clustering bypass for polygons

`L.markerClusterGroup` accepts only `L.Marker` and `L.CircleMarker` instances — it does not support `L.Polygon` or `L.Polyline`. Passing a polygon layer to `clusterGroup.addLayer` silently fails or throws depending on the Leaflet.MarkerCluster version.

The `addLayers` and `clearLayers` functions check `appState.geomType` before deciding whether to use the cluster group:

```js
const useCluster = APP_CONFIG.clustering && appState.geomType === 'point';
```

For polygon geometry, layers are added directly to the map via `layer.addTo(map)`. The `clustering` config flag is silently ignored for polygon deployments rather than throwing or warning, since the desired behaviour (draw all polygons) is unambiguous.

---

## Polygon draw order and sorting

Polygons are added to the map in the order they appear in `primaryBase`, which is sorted by the active primary sort column. For points, draw order is invisible. For polygons, later-added layers render on top of earlier ones in Leaflet's SVG/Canvas renderer.

This means the sort column indirectly controls which polygon appears on top when polygons overlap. In practice this is rarely observable since polygon deployments typically show non-overlapping administrative or geological units. If overlapping polygons become a concern, the fix is to separate the array used for table rendering (sorted) from the array used for layer creation (unsorted or sorted by a fixed z-order field).

---

## Special filter pre-computation (`specialFilterIds`)

Special filters restrict primary results to records that have at least one linked record in a specific sibling dataset. Naively, this would require scanning the sibling dataset on every pan.

Instead, at load time, a `Set` of link field values is built for each tab that declares `specialFilter`:

```js
appState.specialFilterIds[tab.key] = new Set(
    appState.allData[tab.key].map(r => r[LINK_FIELD]).filter(Boolean)
);
```

`applyBoundsFilter` then intersects `visibleIds` with this pre-computed set in O(n) time where n is the number of in-bounds primary records.

---

## MapLibre Geomaterials theme

The MapLibre application reads the deployment settings from `geomaterials/config.js` as `window.GEOMATERIALS_CONFIG`. This file is the configuration source for the MapLibre JSON theme; the standalone Leaflet page is not required to consume it.

Dataset file names are resolved beneath `dataDirectory`. Deployment-link definitions are read from `deploymentsFile` and `deploymentLinksFile`. To change the sample-tray image host for production, update only `urlBases.sampleTrayImages`; computed-link construction resolves the configured `baseKey` at runtime.

The MapLibre implementation ports the configured Geomaterials behavior into its own theme lifecycle, map source, filter state, tables, and export. The Leaflet functions above remain useful as a behavioral reference, not as runtime dependencies.

---

## Numeric field detection

`getNumericFields(data)` inspects the first non-null value in each column across the dataset and checks whether `parseFloat` returns a non-NaN value. Columns named in `nonNumericColumns` are excluded regardless.

This works correctly for the common case where the database exports consistently typed fields. It can misfire if a column's first non-null value is numeric but later values are not (e.g. a mixed notes field that starts with a number). The `nonNumericColumns` config option is the escape hatch for known problem columns.

Detection runs once at load time and the result is cached in `numericFieldCache`. Subsequent renders read from the cache rather than re-examining the data.

---

## `truncateCells` and virtual scrolling

Cell truncation (`white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 260px`) is applied as a CSS class on the `<table>` element when `APP_CONFIG.truncateCells !== false`. This keeps rows at a consistent height — a requirement for virtual scrolling, which assumes all rows are the same height.

If `truncateCells` is false, cells can wrap and rows will have variable height. The virtual scroll will then produce incorrect spacer heights and potentially show the wrong rows at a given scroll position. `truncateCells: false` should only be used with small datasets where virtual scrolling is not needed (< ~500 rows) or when the `--row-height` variable is set to an average/maximum expected row height.

---

## Adding a new deployment

1. Copy `index.html` or `index_polygon.html`
2. Edit `APP_CONFIG` — change `title`, `brandColor`, `linkField`, `geometryField`, `labelField`, `projection`, `mapCenter`, `mapZoom`, `tabs`, and whichever of `depthClasses` / `symbology` applies
3. Export JSON from the database and place alongside the index file
4. Test — `validateConfig()` runs on load and will report any missing required fields

The shared JS and CSS files do not need to change. If you need behaviour that `APP_CONFIG` cannot express, consider whether it belongs in config before modifying the JS.

---

## Combined geometry handling

`app_combined.js` handles both point and polygon geometry in a single file. The geometry type is detected from the first record in the primary dataset and stored in `appState.geomType`. Code paths that diverge by geometry type are gated on this value:

- `buildGeomCacheEntry` — branches on WKT prefix (`POINT` vs `POLYGON`/`MULTIPOLYGON`)
- `createLayer` — `L.circleMarker` for points, `L.polygon` for polygons
- `buildLegend` — depth classes (points) vs categorical colour (polygons)
- `addLayers` / `clearLayers` — cluster group (points) vs direct map layer (polygons)
- `isVisible` — `bounds.contains` (points) vs `bounds.intersects` on pre-computed bbox (polygons)
- `zoomToAllExtents` — `setView` on a single point vs `fitBounds` across all polygon bboxes

All filtering, table rendering, export, URL state, and UI logic is geometry-agnostic. The `clustering` config flag is silently ignored when `geomType` is `'polygon'`.

---

## Tab help popup

Tabs can declare an optional `help: { title, content }` property. When present, a `?` icon (`<span class="tab-help-trigger">`) is rendered as a child of the tab button. The trigger has `tabindex="-1"` and `aria-hidden="true"` so it never appears in the keyboard Tab order — it is click-only.

Clicking the trigger toggles the popup. The popup is positioned with `position: fixed` in JavaScript after computing the trigger's bounding rect, then clamped to the viewport. Fixed positioning is required because the tab bar's `overflow: hidden` would clip an absolutely-positioned child.

A document-level click listener closes all open popups when the user clicks outside. Escape also closes them. The popup itself has `pointer-events: auto` so links inside it are clickable.

**Auto-linking:** `linkifyContent()` runs on the popup's content node after insertion. It walks text nodes with a `TreeWalker`, splits any that contain bare URLs, and wraps the URL segments in `<a>` elements with `target="_blank" rel="noopener noreferrer"`. Existing `<a>` tags get the same attributes added. This means `content` can be plain text with bare URLs and they will be rendered as working links.

---

## Range operator toggle

Each range filter column has a `≥`/`≤` operator badge that is a clickable `<button>` element. Clicking it toggles the operator for that column and immediately re-runs `applyAllFilters`.

The operator is stored in `appState._rangeOperator[tabKey][col]` using nullish-coalescing assignment (`??=`) so it is initialised from `APP_CONFIG.rangeFilterColumns[col]` exactly once per column. Unlike `rangeState` (which is cleared by Clear All and Zoom to All), `_rangeOperator` is intentionally **not** cleared by those actions — the operator is a column preference, not a filter value.

The operator is serialised into URL state and validated on restore.

---

## `clearAllFilters()` helper

The shared `clearAllFilters()` function consolidates state-reset logic that was previously duplicated in the Clear All button handler and `zoomToAllExtents`. It:

- Clears all `.column-search` input values
- Resets `searchState`, `rangeState`, and `sortState` for all tabs
- Clears each dropdown `Set` in-place (closures in the dropdown widgets hold references to these objects — replacing the Set would orphan them)
- Resets all `_rangeOperator` values to their `APP_CONFIG` defaults
- Updates visible operator badge labels
- Closes all open dropdowns and resets dropdown summary labels
- Clears `activeSpecialFilter` and removes the `active` class from special filter buttons

Both the Clear All button handler and `zoomToAllExtents` call `clearAllFilters()` then proceed with their own follow-up logic (URL cleanup or bounds zoom respectively).

---

## `hasTabActiveFilters(tabKey)` and `intersect(a, b)`

Two small helpers extracted to eliminate repetition:

```js
function hasTabActiveFilters(tabKey) {
    return (
        Object.values(appState.searchState[tabKey]).some(v => v) ||
        Object.keys(appState.rangeState[tabKey]).length > 0 ||
        Object.values(appState.dropdownState[tabKey] || {}).some(s => s?.size > 0)
    );
}

function intersect(a, b) { return new Set([...a].filter(id => b.has(id))); }
```

`hasTabActiveFilters` is used in both `updateMapAndTables` (Pass 1 narrowing gate) and `computeDropdownOptions` (skip computation if nothing is active). `intersect` replaces inline `new Set([...a].filter(...))` patterns at all call sites.

---

## Safari keyboard navigation fix

Safari does not include `<button>` and `<a>` elements in the Tab order by default (unlike Chrome and Firefox). This affects every interactive element in the application — filter inputs are standard `<input>` elements and work fine, but zoom buttons, clear-filter pill buttons, dropdown summary buttons, and operator badge buttons are all skipped.

`applySafariTabindex(root)` sets `tabindex="0"` on all `button:not([tabindex])` and `a[href]:not([tabindex])` within a given root. The `:not([tabindex])` selector preserves existing explicit values — notably the help trigger's `tabindex="-1"`, which must stay out of the Tab order.

`initSafariTabFix()` runs `applySafariTabindex(document.body)` on startup, then attaches a `MutationObserver` to the body that calls `applySafariTabindex` on each added node. This covers dynamically created elements: active filter pills (added on filter change), zoom icon buttons (added per row in the virtual table renderer), and dropdown widget controls (added on first open).

---

## Config validation

`earlyValidateConfig()` runs as an IIFE before any derived constants are computed. It checks all required top-level fields, validates each tab's required properties, and validates cross-field constraints (e.g. exactly one `isPrimary: true` tab). Errors are collected into an array and displayed as a single itemised alert, then `throw` stops execution cleanly before any DOM manipulation or data loading begins.

Running validation before derived constants prevents confusing secondary errors (e.g. `Cannot read properties of undefined`) that would otherwise surface when misconfigured values propagate into computed fields.

---

## `projectionDef`

`APP_CONFIG.projectionDef` is an optional string holding a proj4 definition for the source CRS. If absent, the application uses a built-in definition for EPSG:29902 (Irish Transverse Mercator / Irish Grid). If present, it is passed to `proj4.defs(APP_CONFIG.projection, APP_CONFIG.projectionDef)` before any geometry is projected.

This allows any proj4-supported CRS to be used without modifying the application. Definition strings can be copied directly from [epsg.io](https://epsg.io) — each CRS page shows a proj4 string that can be pasted verbatim.

---

**Geographic filter cannot be pinned.** There is no "lock to current bounds" mode. Panning always updates the result set. This is intentional — the map view and the data view are always in sync — but it means zoom is not a selection mechanism.

**Polygon colour collisions.** The hash-based colour assignment can produce similar colours for similar string values. There is no perceptual distance guarantee. A future `colorMap` config option mapping explicit values to colours would address this.

**Single geometry type per deployment.** The geometry type is detected from the first record and assumed consistent for the entire dataset. Mixed-geometry datasets (e.g. both points and polygons in the same primary tab) are not supported.

**Export reflects virtual table contents.** The Excel export reads from `virtualRows`, which is the sorted and column-filtered set. It does not re-query the database. If data changes between page load and export, the export reflects the loaded data, not the current database state.

**No authentication or row-level security.** The application loads all data from static JSON files. Any user who can access the JSON file can access all its records, regardless of what filters are active. Row-level filtering is presentation-only.
