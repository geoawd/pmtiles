This project is a lightweight Maplibre gl application.
It uses epsg 3857. It loads data from a pmtiles file and cloud optimised geotiffs.

Most of this application is working but there are some changes I want to make. 

1. I want a basemaps config in config.js.
Each basemap will appear in a basemaps group in the left most menu. When expanded, each basemap can be toggled on and off and transparancy set on a layer by layer basis. This should follow how the functionality works for other layers. Basemaps persit across all themes. The selected basemaps should also be shown in a basemaps section in the layers panel.

2. Add an about to the bottom of the left most menu. This will be pop out a panel (where the layers and search are) that is populated from text in config.js

3. For each legend header (lghead) add an 'eye' that turns the group off (but remembers the layer state if toggled back on).

4. When a theme is loaded, all layers are turned off unless a default is specified in the config.

5. Terrain in the layers panel. Move the model dropdown so that it appears when the button terrain-tools is clicked.

6. Add a simple zoom to all extents beside the main map navigation controls.

Implement these in the most sensible order. Do not break existing functionality.