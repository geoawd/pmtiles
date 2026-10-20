# Repository Guide

## What this project is

This repository contains a static, browser-based map viewer for Northern Ireland geology and site-investigation data. It uses MapLibre GL JS, PMTiles, and configuration-driven vector, raster, and JSON-backed themes. There is no bundler or build step; most third-party browser libraries are loaded from CDNs.

## Run locally

Use Python 3 to serve the repository over HTTP:

```sh
python3 serve.py
```

The server opens the app in a browser on port 8000 by default. Use `python3 serve.py --no-browser` to suppress that, or `--port PORT` to choose another port. It supports HTTP Range requests, which PMTiles needs. Do not open `index.html` directly with `file://`.

## Startup and structure

- `index.html` defines the application shell and loads the browser libraries, `config/config.js`, and `js/styles.js`.
- `config/config.js` defines the global `window.CONFIG`: map defaults, datasets and styles, overlays, themes, terrain, search, and layer metadata.
- `js/styles.js` fetches and merges the configured MapLibre styles, then loads `js/app.js`.
- `js/app.js` implements the map UI and interactions, including layers, search, results, exports, popups, and theme switching.
- `js/json-theme-runtime.js` loads JSON theme modules and data, builds map features, and provides shared JSON-theme filtering and geometry helpers.
- `config/config_*.js` contains per-theme JSON configuration. These modules are loaded dynamically when their themes are selected.
- `config/*.json` contains MapLibre styles and deployment/link metadata.
- `data/layers.pmtiles` is the vector tile archive used by the configured styles. JSON records live under `data/geomaterials/`, `data/site-investigations/`, and `data/test-deployment/`.
- `css/app.css` styles the interface. `design/application-design.md` documents map and JSON-theme behavior in more detail.

## Configuration and data conventions

- Add or change map themes in `config/config.js`. A theme can select vector layers, datasets, overlays, or groups; JSON-backed themes specify both `jsonTheme` and `jsonConfig`.
- Keep dataset IDs, style paths, PMTiles URLs, and style source/layer names aligned. When changing data or style locations, update the configuration that references them.
- A JSON theme config declares its data directory and tabs. Each tab's file must contain an array at its configured `dataKey`. Declare exactly one primary tab; related tabs join to primary rows using the configured `linkField`.
- Map geometry can come from a WKT/GeoJSON field in the primary JSON records or, for themes such as Site Investigations, from a configured vector dataset and layer joined by ID. Keep geometry, projection, and link-field settings consistent with the source data.
- Update `design/application-design.md` when changing JSON-theme behavior or data/configuration conventions documented there.

## Development and validation

Run the configuration, JSON-theme runtime, and browser-startup checks with `npm test` (Node.js 18 or later; no dependencies need to be installed). Run the browser-based Site Investigations and Tellus Geophysics checks with `npx playwright install chromium` once, then `npm run test:e2e`. The browser test command starts and stops its own local server. Keep changes compatible with the existing plain JavaScript modules and browser-loaded scripts; check the browser console and network requests for load or configuration errors when manually smoke-testing other runtime changes.
