# Application Design

## Runtime

This is a static browser application served over HTTP; it has no build step. `index.html` loads the vendor libraries and `js/config-loader.js`. The config loader selects a profile, loads its `window.CONFIG`, and then starts `js/styles.js`. The style loader fetches configured MapLibre styles, merges their vector sources/layers, and starts `js/app.js` as a module. `js/app.js` owns the map, layer controls, theme switching, search, popups, and results panels.

The top-right map controls include the expanded Terra Draw toolbar directly below **Find My Location**, with point, line, polygon, rectangle, circle, freehand, angled rectangle, sensor, sector, select, delete, and download tools.

On mobile, the tools drawer opens at 45% of the viewport height, can be dragged up to 80%, and closes when dragged down below 25%. Globe and print controls are hidden at mobile widths.

## Session Recovery

The viewer autosaves a versioned session snapshot to browser `localStorage`. On a later visit, it offers **Resume** or **Reset app** when a valid snapshot exists. Resume restores the active theme, map view, layer visibility and transparency, COG display settings, and terrain settings. Reset app clears the saved session and manually added layers, and clears filter state encoded in the URL hash. Internal profile state uses separate storage keys; the public profile retains its existing keys. Nothing is sent to a server.

## Directory Layout

- `config/config.js`: public profile's `window.CONFIG` for map defaults, vector datasets, basemaps, raster overlays, themes, legend metadata, search, and terrain.
- `config/config.internal.js`: internal profile's `window.CONFIG`; present only on the internal branch.
- `js/config-loader.js`: loads the public profile by default, or the internal profile when opened with `?profile=internal`.
- `config/config_geomaterials.js`: `window.GEOMATERIALS_CONFIG` for the JSON-backed Geomaterials theme: data paths, schemas, filters, links, popups, and depth symbology.
- `config/*.json`: MapLibre styles and deployment/link configuration.
- `data/layers.pmtiles`: vector tile archive used by the configured styles.
- `data/geomaterials/*.json`: Geomaterials tables. Each file contains an array at the configured `dataKey`.
- `js/`: startup/style merging and map application behavior.
- `css/app.css`: application and panel styling.

## Map Configuration

Edit the profile config to change its map-wide setup: `config/config.js` for public, or `config/config.internal.js` for internal. The internal URL must include `?profile=internal`; omitting the parameter loads the public profile.

- `datasets` associates a dataset ID and display name with a style file and PMTiles URL.
- `basemaps` describes persistent raster basemaps.
- `overlays` describes WMS, ArcGIS MapServer, XYZ raster, and COG layers. Use `group` to organize overlays in the layer panel. The config loader applies `encodeURI` once to overlay and terrain COG URLs; supply unencoded paths and avoid pre-encoding percent escapes. Single-band COGs expose selectable color ramps with continuous styling, smooth 64-stop quantile styling, a percentile-clipped style that stretches the 2nd–98th percentile sample range across the ramp, or configured class breaks. Multiband COGs keep their native RGB rendering. COG metadata and value-range samples are requested only while a COG layer is effectively visible; hidden COGs do not trigger sampling, and sampling stops if a layer is hidden before the range is complete. COG overlays accept `resampling: 'nearest'` or `resampling: 'bilinear'`; the default for color rasters remains nearest. Set optional `legendunits` on a COG overlay to show its units on the left of the legend title, with the ramp name aligned right above the color bar. COG hillshade controls are hidden unless an individual COG has `hillshade_option: true` (the string `'true'` is also accepted); when enabled, hillshade is on by default at 20% strength. COG hillshade relief is automatically scaled from the sampled value range toward a 100-unit range to make low-range rasters visible; the relief exaggeration slider provides a 1–100 nonlinear adjustment. The expanded COG controls include a copy action for the source URL, suitable for adding the raster to GIS software. Changing the COG transparency also scales its hillshade strength by the remaining opacity. Quantile stop positions and percentile clipping bounds come from a sample of the lowest-resolution available overview; quantile colors are interpolated into one raster layer to avoid seams between independently masked classes. Configured breaks use each `max` as the inclusive upper bound of a class; values above the last break use the final ramp color. Break labels are optional and appear in the class legend. The color ramp is divided evenly over the resulting classes, and the COG renderer's lookup palette has 4096 stops. For example:

  ```js
  {
    id: 'my_cog',
    name: 'My COG',
    cog: 'https://example.org/data/my-raster.tif',
    legendunits: 'ppm',
    resampling: 'bilinear',
    classes: [
      { max: 50, label: '2nd percentile' },
      { max: 100, label: 'Median' },
      { max: 250, label: '98th percentile' }
    ]
  }
  ```

  Supply the COG as a hosted, browser-accessible Cloud Optimized GeoTIFF URL, and set `classes` on that COG overlay in the relevant `window.CONFIG`. Configure ascending finite `max` values; the first class covers values up to its break, each following class covers values above the previous break through its own break, and one final open-ended class follows the last break. Select any available ramp in the layer controls; its colors are distributed across those classes, with a matching discrete legend. COGs without `classes` retain the existing display modes. The default ramp is CET rainbow4. The picker also includes 27 continuous/diverging Colorcet `palette_n` ramps; their 256-color data and CC BY 4.0 attribution are in `js/colorcet-ramps.js`.

  While the cursor is over the map, a separate readout above the zoom and coordinate indicators shows sampled values for visible single-band COGs, one `layer name: value` per line. Configured `legendunits` are appended to each value.

- `themes` controls layer visibility. `layers` accepts vector source-layer names; `datasets` expands to the source layers from a configured dataset; `overlays` accepts overlay IDs; `groups` accepts style legend-group names, overlay-group names, or another named theme. Names are matched exactly and are case-sensitive. A theme with no selection properties allows all configured layers; specify at least one selection property to turn unlisted layers off. When a group containing multiple raster overlays (such as COGs or WMS layers) is added as data, only its first raster overlay is enabled by default; the others stay available in the theme but start off. Legend symbols and raster colour ramps are shown only while their layer checkbox is on. The Add data panel starts with groups collapsed and filters by group or layer name.

For example, Geomaterials currently uses `groups: ['Geology WMS']`. That named theme supplies its configured WMS overlay IDs to Geomaterials. Borehole depth and Quick Filters/Results Table remain Geomaterials-specific groups at the top of the layer panel.

MapLibre style JSON files reference the vector tiles. If a style is moved, update its path in `datasets`; keep `pmtiles` pointed at `data/layers.pmtiles`.

## Geomaterials JSON Data

Edit `config/config_geomaterials.js` to configure the Geomaterials theme. Each `tabs` entry specifies a JSON filename, its top-level `dataKey`, display name, and optional behavior. One tab is primary; its records provide the map geometry and IDs. Sibling records join to primary records by `linkField`.

The primary geometry is WKT in the configured projection. Valid borehole points are projected into WGS84 and rendered by MapLibre. On map movement, the current bounds scope the primary IDs; special filters and persistent column filters then intersect those IDs across datasets. Text/range filters use AND semantics, selected values within one dropdown use OR semantics, and the final intersected IDs drive the map and tables.

Useful per-deployment settings include:

- `dataDirectory`, `file`, and `dataKey` for the JSON locations and shapes.
- `dropdownColumns`, `rangeFilterColumns`, `hiddenColumns`, and `nonNumericColumns` for table filtering and presentation.
- `urlFields`, `computedLinks`, `urlBases`, and deployment link files for external destinations. Change `urlBases.sampleTrayImages` to set the production sample-tray image host.
- `popupFields`, `help`, `depthField`, and `depthClasses` for feature details, tab help, and map symbology.

Add a new data table by placing its JSON file under `data/geomaterials/` and adding a tab with the matching filename and top-level `dataKey`. Sibling tables need the same join field as the primary data.

## Results and Popups

The results panel is shared with vector query results. In the Geomaterials theme it adds dataset tabs, aligned column filters, sorting, exports, and shareable filter/map state. The Linked data eye controls the panel; changing filters or map bounds can reopen it. The panel is resizable.

Clicking a borehole opens configured primary details plus expandable sibling sections containing that borehole's currently filtered rows. Only one popup section stays expanded at a time; sections with multiple results have previous/next controls.
