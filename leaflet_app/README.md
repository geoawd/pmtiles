# Geospatial Tabular Data Viewer

A lightweight, browser-based application for exploring geospatial datasets. It combines an interactive map with linked data tables, allowing users to filter, search, and export records across multiple related datasets. The application is designed to be reused across different datasets by changing a single configuration block — no coding required.

A single combined file — **`app_combined.js` / `app_combined.css`** — handles both point and polygon geometry. The geometry type (`POINT`, `POLYGON`, `MULTIPOLYGON`) is detected automatically from the first record in the primary dataset. No configuration flag is needed to switch between geometry types.

---

## What it does

- Displays point or polygon locations on an interactive map (OpenStreetMap, Satellite, or Topographic basemap)
- Shows related data in tabs below the map — each tab is a separate dataset linked to map features by a common ID field
- Filtering is cross-linked: filtering on any tab — primary or sibling — updates the map and all other tabs simultaneously
- All filters are AND — a record must pass every active filter across every tab to appear on the map and in the tables
- Panning and zooming updates results to the current map view while preserving active column filters
- Point markers can be clustered at low zoom levels, or individually coloured by a field value with a depth legend
- Polygons are outlined and coloured by a configurable field, with each distinct value assigned a stable auto-generated colour and a categorical legend
- Active filters are displayed as removable pills below the visible record count — click × on any pill to clear that filter individually
- Each tab label shows a live count of its currently visible rows
- Clicking a map feature opens a popup; clicking the zoom icon in any table row or popup zooms the map to that feature
- The current filtered view — all active column filters, special filters, and map position — can be shared as a URL via the **Copy Link** button
- Records can be exported to Excel with a choice of all rows or filtered rows only
- All data is loaded from local JSON files — no server-side processing required

---

## File structure

```
/your-deployment/
    index_combined.html     <- configuration for this deployment (the only file you edit)
    app_combined.js         <- application logic — points and polygons (shared, never edit)
    app_combined.css        <- styles (shared, never edit)
    primary.json            <- primary dataset (map features)
    dataset2.json           <- linked dataset
    ...
```

For multiple deployments sharing the same application files:

```
/shared/
    app_combined.js
    app_combined.css

/geomaterials/
    index_combined.html     <- references ../shared/app_combined.js
    api_v2_boreholes.json
    ...

/geology-polygons/
    index_combined.html     <- references ../shared/app_combined.js
    api_v2_features.json
    ...
```

> **Note:** The application must be served from a web server. It cannot be opened directly from the file system using `file://` URLs — browsers block JavaScript from loading local JSON files via that protocol. Use a local development server (e.g. Python's `http.server`, VS Code Live Server, or nginx) for local testing.

---

## How filtering works

Understanding the filtering model is essential for getting predictable results. There are three independent layers of filtering that apply in strict priority order. A record must pass **every active layer** to appear on the map and in the tables.

### Layer 1 — Geographic scope (highest priority, always active)

Only records whose geometry falls within the current map viewport are considered. For points, inclusion requires the location to be within the bounds rectangle. For polygons, inclusion requires the polygon's bounding box to intersect the bounds rectangle.

Geographic scope is always active and always reflects the live viewport. There is no way to pin or disable it. Panning or zooming does not clear column filters — it changes which records those filters are applied to.

### Layer 2 — Special filters

Header buttons that restrict primary results to records that have at least one linked record in a specific sibling dataset (e.g. "With Core Boxes"). Only one special filter can be active at a time. Applied on top of geographic scope.

### Layer 3 — Column filters (lowest priority, persistent)

There are three types of column filter, configured per column in `APP_CONFIG`:

- **Text search** — case-insensitive substring match. The default for any column not listed in `rangeFilterColumns` or `dropdownColumns`.
- **Numeric range** — a threshold filter. The default operator (`≥` or `≤`) is set per column in `rangeFilterColumns`. The operator badge is a button — click it to toggle between minimum (`≥`) and maximum (`≤`) for that column. The toggled operator is preserved across filter cycles and serialised in shared URLs.
- **Multi-select dropdown** — a constrained dropdown showing only values present in the current result set. Configured via `dropdownColumns`. Selection within a column is OR (any of the selected values match); across columns it is AND.

Column filters are **persistent** — they survive pan and zoom. Filters from multiple columns and multiple tabs all combine with AND. A location appears on the map only if it passes all active column filters across all tabs simultaneously.

Same-named columns on different tabs (e.g. a depth column on both the geology and core boxes tabs) are filtered independently — the filter on one tab has no effect on the same-named column on another tab.

### Dropdown filter behaviour

Dropdown options are constrained by the current geographic bounds, active special filter, and all other active column filters. If you select LEX = GN, the STATUS dropdown narrows to only show statuses that exist on GN records within the current bounds. This means you can never select a combination that produces zero results.

Options update automatically as you apply or clear other filters and as you pan or zoom.

### Cross-tab filter evaluation

When any filter changes, the application evaluates the full filter state in two passes:

1. The **primary column-filtered set** is computed first — primary records within bounds that pass all active primary tab column filters. This is the authoritative scope for everything else.
2. **Pass 1 — compute the final intersection:** Every sibling tab that has active filters narrows the intersection of primary IDs. This pass runs across all sibling tabs before any table is rendered, so the order tabs appear in the config does not affect the result.
3. **Pass 2 — render all tables:** All sibling tables are rendered from the fully-resolved intersection. A sibling with active filters shows only rows matching the intersection; a sibling with no active filters shows all rows for the intersected locations.
4. **The primary table and map** are both rebuilt from the final intersection — if a geology filter reduces results to 12 locations, the boreholes table, every other sibling table, and the map all show exactly those 12.

The map, the primary table, and all sibling tables always show the same set of locations.

### What panning and zooming does

Panning or zooming replaces the geographic bounds snapshot and re-runs all active column filters against the new snapshot. The filter values are unchanged. Zooming in narrows results to the intersection of the new bounds and your existing filters. Zooming back out re-expands while keeping your filters applied.

Zoom is a scope mechanism, not a selection mechanism. The application does not remember which records were visible before a zoom.

### Active filter pills

The panel below the visible record count shows a pill for every active filter — column filters from any tab and special filters — labelled with the tab name, column name, and value. Dropdown filters show all selected values in one pill per column. Clicking × on a pill clears that individual filter without affecting others.

### Sharing a filtered view

The **Copy Link** button encodes the current filter state and map position into the URL hash at the moment it is clicked, then copies the URL to the clipboard. Anyone opening that link sees exactly the same filtered view. The URL is not updated continuously — only when Copy Link is pressed. Clicking **Clear All Filters** removes any existing hash from the URL.

---

## Data model

The application expects one **primary dataset** and any number of **sibling datasets**. The primary dataset owns the map features. All sibling datasets must share the same ID field to link back to primary records.

### JSON data format

Each JSON file must wrap its records in a top-level key matching the `dataKey` value in the tab configuration:

```json
{
    "api_v2_boreholes": [
        {
            "BOREHOLE ID": "CSBH-00001",
            "BOREHOLE NAME": "My Borehole",
            "GEOM": "POINT (287917 413754)",
            "TOTAL DEPTH METRES": 120.5
        }
    ]
}
```

For polygon deployments the geometry field contains WKT in the source CRS:

```json
{
    "api_v2_features": [
        {
            "FEATURE ID": "F-001",
            "FEATURE NAME": "North Block",
            "STATUS": "Active",
            "GEOM": "POLYGON ((287917 413754, 288100 413754, 288100 414000, 287917 413754))"
        }
    ]
}
```

Both `POLYGON` and `MULTIPOLYGON` WKT are supported. The geometry type is detected automatically from the first record.

### Configuration validation

On load the application validates `APP_CONFIG` and displays a clear itemised error if any required field is missing or misconfigured.

---

## Preparing data from a database

### PostgreSQL — points

```sql
CREATE OR REPLACE VIEW api_v2_boreholes AS
SELECT
    b.borehole_id       AS "BOREHOLE ID",
    b.borehole_name     AS "BOREHOLE NAME",
    b.company_name      AS "COMPANY NAME",
    b.total_depth_m     AS "TOTAL DEPTH METRES",
    b.log_url           AS "BOREHOLE_LOG_URL",
    'POINT (' || ST_X(ST_Transform(b.geom, 29902))::text
             || ' '
             || ST_Y(ST_Transform(b.geom, 29902))::text
             || ')' AS "GEOM"
FROM boreholes b;
```

### PostgreSQL — polygons

```sql
CREATE OR REPLACE VIEW api_v2_features AS
SELECT
    f.feature_id        AS "FEATURE ID",
    f.feature_name      AS "FEATURE NAME",
    f.status            AS "STATUS",
    ST_AsText(ST_Transform(f.geom, 29902)) AS "GEOM"
FROM features f;
```

`ST_AsText` produces `POLYGON (...)` or `MULTIPOLYGON (...)` WKT directly.

### Sibling datasets

All sibling views must include the shared ID field with the same name as on the primary dataset:

```sql
CREATE OR REPLACE VIEW api_v2_downhole AS
SELECT
    b.borehole_id   AS "BOREHOLE ID",   -- must match primary
    g.lex_code      AS "LEX",
    g.top_depth_m   AS "TOP",
    g.description   AS "DESCRIPTION"
FROM downhole_geology g
JOIN boreholes b ON b.id = g.borehole_fk;
```

### Exporting to JSON

```bash
psql -d your_database -c \
  "COPY (
      SELECT json_build_object('api_v2_boreholes', json_agg(row_to_json(v)))
      FROM api_v2_boreholes v
   ) TO '/path/to/deployment/api_v2_boreholes.json';"
```

Or with Python:

```python
import psycopg2, json

conn = psycopg2.connect("dbname=your_database")
cur  = conn.cursor()
cur.execute("SELECT row_to_json(v) FROM api_v2_boreholes v")
rows = [r[0] for r in cur.fetchall()]

with open('api_v2_boreholes.json', 'w') as f:
    json.dump({'api_v2_boreholes': rows}, f)
```

---

## Creating a new deployment

### 1. Copy the template index file

Copy `index_combined.html`. The shared JS and CSS (`app_combined.js`, `app_combined.css`) handle both point and polygon geometry — no separate variant is needed.

### 2. Prepare your JSON files

Export each dataset and place the files alongside the index file, or adjust the `file` paths in the tab config.

### 3. Edit APP_CONFIG

The `APP_CONFIG` block in the index file is the only thing you need to change.

### 4. Test locally

Serve from a local web server and open the index file. Configuration errors appear immediately as an alert and in the browser console. Check the console for JSON loading errors — each tab loads independently, so a single failed tab shows an error in its own pane without blocking the others.

---

## APP_CONFIG reference

### Top-level fields

| Field | Type | Description |
|---|---|---|
| `title` | string | App title shown in the header and browser tab |
| `brandColor` | string | CSS colour for the header and active tab |
| `linkField` | string | Field name joining all datasets (the foreign key) |
| `geometryField` | string | Field containing WKT geometry on the primary tab |
| `projection` | string | EPSG code of the geometry CRS (e.g. `'EPSG:29902'`) |
| `projectionDef` | string | Optional. proj4 definition string for the CRS above. Required for any projection other than `EPSG:29902` (Irish Grid), which is built in. Look up strings at [epsg.io](https://epsg.io). Example: `'+proj=tmerc +lat_0=49 +lon_0=-2 +k=0.9996012717 +x_0=400000 +y_0=-100000 +datum=OSGB36 +units=m +no_defs'` for British National Grid |
| `labelField` | string | Display name field; used in popups and sibling tab headers |
| `mapCenter` | [lat, lng] | Initial map centre |
| `mapZoom` | number | Initial zoom level |
| `clustering` | boolean | `true` to cluster point markers at low zoom. Ignored for polygon geometry |
| `truncateCells` | boolean | Truncate long cell values with ellipsis; hover shows full value. Default: `true` |
| `depthField` | string | Field used to colour point markers (`clustering: false` only) |
| `hiddenColumns` | string[] | Columns hidden from tables and export |
| `nonNumericColumns` | string[] | Columns with numeric-looking values that should not be treated as numbers |
| `dropdownColumns` | string[] | Columns that get a multi-select dropdown filter instead of a text input. Applies to every tab where the column appears |

### Polygon symbology

The `symbology` block replaces `depthField`/`depthClasses` for polygon deployments:

| Field | Type | Description |
|---|---|---|
| `symbology.colorField` | string | Field whose distinct values drive stroke colour. Each value gets a stable auto-generated colour |
| `symbology.strokeWidth` | number | Outline width in pixels. Default: `2` |
| `symbology.fillOpacity` | number | `0` = outline only, `1` = fully filled. Default: `0` |
| `symbology.showLegend` | boolean | Show the categorical colour legend. Default: `true` |

### Tabs

| Field | Type | Description |
|---|---|---|
| `key` | string | Internal identifier used for element IDs |
| `label` | string | Tab label |
| `file` | string | Path to the JSON data file |
| `dataKey` | string | Top-level key inside the JSON file |
| `isPrimary` | boolean | Exactly one tab must be `true` |
| `icon` | string | Font Awesome icon class |
| `specialFilter` | string | If set, generates a header button that restricts to primary records linked in this dataset |
| `exportRows` | string | `'filtered'` or `'all'` |
| `help` | object | Optional. Adds a `?` icon to the tab. Click to show a popup. See below |

### Tab help popup

```js
help: {
    title:   'Optional title (defaults to tab label)',
    content: '<p>HTML or plain text description of this dataset.</p>',
}
```

`content` accepts plain text or HTML. Bare URLs in either format are automatically converted to links that open in a new window. The popup is shown on click only — it is not shown automatically on keyboard focus.

### rangeFilterColumns

```js
rangeFilterColumns: {
    'TOTAL DEPTH METRES': 'gte',   // >= minimum
    'BOTTOM DEPTH (M)':   'lte',   // <= maximum
}
```

### dropdownColumns

Columns listed here get a constrained multi-select dropdown instead of a text input. Options are limited to values present in the current bounds, special filter, and other active column filters — so selecting one dropdown can narrow the options available in another. Selecting multiple values within a column is OR; combining active filters across columns is AND.

```js
dropdownColumns: ['STATUS', 'LEX', 'FORMATION'],
```

The column name applies globally — if `STATUS` is listed, every tab that has a STATUS column gets a dropdown. Each tab's selection is independent.

### popupFields

```js
popupFields: [
    { field: 'BOREHOLE NAME', bold: true },
    { field: 'COMPANY NAME' },
    { field: 'TOTAL DEPTH METRES', label: 'Total Depth', suffix: ' M' },
    { type: 'zoomLink', label: 'Zoom to site' },
]
```

### urlFields

```js
urlFields: { 'BOREHOLE_LOG_URL': 'View Log' }
```

### computedLinks

```js
computedLinks: [
    {
        field:  'BOREHOLE NAME',
        prefix: 'https://yourapp.com/search?q=',
        icon:   'fa-external-link-alt',
        title:  'Open in external system',
    },
]
```

### depthClasses (points only)

```js
depthClasses: [
    { max:        0, fill: '#aaaaaa', label: 'Null / unknown' },
    { max:       50, fill: '#2166ac', label: '0 – 50 m'       },
    { max:      100, fill: '#74add1', label: '50 – 100 m'     },
    { max: Infinity, fill: '#7b0000', label: '1500+ m'        },
]
```

---

## Performance

- **Geometry cache** — all geometries are projected once at load time. For polygons, bounding boxes are pre-computed for O(1) intersection tests during pan and zoom.
- **Numeric field cache** — column types detected once at load time.
- **Table header cache** — headers and filter inputs built once per tab, not on every pan.
- **Special filter ID cache** — sets of linked IDs pre-computed once at load time.
- **Virtual tables** — only viewport-visible rows are in the DOM. The `--row-height` CSS custom property must match the actual rendered row height — update it if you change cell padding.
- **Debounced filter inputs** — 180ms debounce on column filter inputs.
- **Marker clustering** — `clustering: true` uses Leaflet MarkerCluster. Not applicable to polygon geometry.

---

## Accessibility

- Table headers have `scope="col"`; sorted columns have `aria-sort` and a ▲/▼ indicator
- Column filter inputs have `aria-label`
- Zoom-to-feature buttons in table rows are focusable `<button>` elements with `aria-label`
- Active filter pill clear buttons have `aria-label` describing the specific filter they remove
- Tab buttons use `aria-selected` and `aria-controls`; tab panes use `tabindex="0"` for keyboard access
- Visible record count uses `role="status"` and `aria-live="polite"`
- Map container has `role="application"` and `aria-label`
- Safari keyboard navigation: Safari skips buttons and links in the Tab order by default. The application applies `tabindex="0"` to all interactive elements on load and via a MutationObserver for dynamically added elements (filter pills, zoom icons, dropdown controls), ensuring full Tab-key navigation in Safari without requiring the system preference change

---

## Dependencies

All loaded from CDN — no build step required.

| Library | Version | Purpose |
|---|---|---|
| Leaflet | 1.9.4 | Interactive map |
| Leaflet.MarkerCluster | 1.5.3 | Marker clustering (points only) |
| proj4js | 2.8.1 | Coordinate projection |
| SheetJS | 0.18.5 | Excel export |
| Font Awesome | 6.4.0 | Icons |

See `NOTICES.txt` for full attribution and license text.
