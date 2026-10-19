# Application Design

## Runtime

This is a static browser application served over HTTP; it has no build step. `index.html` loads the vendor libraries, then `config/config_geomaterials.js` and `config/config.js`, then `js/styles.js`. The style loader fetches configured MapLibre styles, merges their vector sources/layers, and starts `js/app.js` as a module. `js/app.js` owns the map, layer controls, theme switching, search, popups, and results panels.

## Directory Layout

- `config/config.js`: global `window.CONFIG` for map defaults, vector datasets, basemaps, raster overlays, themes, legend metadata, search, and terrain.
- `config/config_geomaterials.js`: `window.GEOMATERIALS_CONFIG` for the JSON-backed Geomaterials theme: data paths, schemas, filters, links, popups, and depth symbology.
- `config/*.json`: MapLibre styles and deployment/link configuration.
- `data/layers.pmtiles`: vector tile archive used by the configured styles.
- `data/geomaterials/*.json`: Geomaterials tables. Each file contains an array at the configured `dataKey`.
- `js/`: startup/style merging and map application behavior.
- `css/app.css`: application and panel styling.

## Map Configuration

Edit `config/config.js` to change the map-wide setup:

- `datasets` associates a dataset ID and display name with a style file and PMTiles URL.
- `basemaps` describes persistent raster basemaps.
- `overlays` describes WMS, ArcGIS MapServer, XYZ raster, and COG layers. Use `group` to organize overlays in the layer panel. Single-band COGs expose selectable color ramps with continuous or smooth 64-stop quantile styling, a horizontal min/max legend, and an optional hillshade blend in the layer transparency panel. Quantile stop positions come from a sample of the lowest-resolution available overview and are interpolated into one raster layer to avoid seams between independently masked classes. The default ramp is Spectrum. The picker also includes 27 continuous/diverging Colorcet `palette_n` ramps; their 256-color data and CC BY 4.0 attribution are in `js/colorcet-ramps.js`.
- `themes` controls layer visibility. `layers` accepts vector source-layer names; `datasets` expands to the source layers from a configured dataset; `overlays` accepts overlay IDs; `groups` accepts style legend-group names, overlay-group names, or another named theme. Names are matched exactly and are case-sensitive. A theme with no selection properties allows all configured layers; specify at least one selection property to turn unlisted layers off.

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
