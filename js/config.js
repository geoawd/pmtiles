// To add a layer: copy one line in `overlays`, change id / name / url. That's all that is required.
// Type is detected from the url (ArcGIS MapServer or WMS) or from `tiles` (XYZ). Everything else is optional.
window.CONFIG = {
  title: 'MAPLIBRE DEMO',        // heading on printouts
  styleUrl: 'style.json',
  queryLayers: null,          // null = auto-detect every layer on a vector source in your style; or list ids
  basemaps: [
    { id: 'osm', name: 'OpenStreetMap', tiles: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
      maxzoom: 19, attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors', opacity: 1, visible: true },
    { id: 'Gray', name: 'World Light Gray Base', tiles: 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}.png',
      maxzoom: 19, attribution: '&copy; ESRI', opacity: 1, visible: false }
  ],

  about: 'Map viewer for Geological Survey of Northern Ireland datasets.',
  bounds: [[-8.5, 53.5], [-5.0, 55.6]], // project extent: southwest and northeast [longitude, latitude]
  layerDefaults: {},          // vector source-layer names enabled at startup, e.g. { Boreholes: true }
  overlays: [


/////////////////////////
//  10K Layers
/////////////////////////

      { id: '10K_landform', name: 'Landform', group: 'Geology (10K) WMS',
      url: 'https://map.bgs.ac.uk/arcgis/rest/services/GeoIndex_GSNI/GSNI_Geology_Landsat_WMS/MapServer/',
      layers: '1', opacity: 0.6, visible: true, attribution: '&copy; GSNI' },

      { id: '10K_linear', name: 'Linear', group: 'Geology (10K) WMS',
      url: 'https://map.bgs.ac.uk/arcgis/rest/services/GeoIndex_GSNI/GSNI_Geology_Landsat_WMS/MapServer/',
      layers: '2', opacity: 0.6, visible: true, attribution: '&copy; GSNI' },

      { id: '10K_mass_movement', name: 'Mass Movement', group: 'Geology (10K) WMS',
      url: 'https://map.bgs.ac.uk/arcgis/rest/services/GeoIndex_GSNI/GSNI_Geology_Landsat_WMS/MapServer/',
      layers: '3', opacity: 0.6, visible: true, attribution: '&copy; GSNI' },

      { id: '10K_artificial', name: 'Artificial', group: 'Geology (10K) WMS',
      url: 'https://map.bgs.ac.uk/arcgis/rest/services/GeoIndex_GSNI/GSNI_Geology_Landsat_WMS/MapServer/',
      layers: '4', opacity: 0.6, visible: true, attribution: '&copy; GSNI' },

      { id: '10K_superficial', name: 'Superficial', group: 'Geology (10K) WMS',
      url: 'https://map.bgs.ac.uk/arcgis/rest/services/GeoIndex_GSNI/GSNI_Geology_Landsat_WMS/MapServer/',
      layers: '5', opacity: 0.6, visible: true, attribution: '&copy; GSNI' },

      { id: '10K_bedrock', name: 'Bedrock', group: 'Geology (10K) WMS',
      url: 'https://map.bgs.ac.uk/arcgis/rest/services/GeoIndex_GSNI/GSNI_Geology_Landsat_WMS/MapServer/',
      layers: '6', opacity: 0.6, visible: true, attribution: '&copy; GSNI' },


/////////////////////////
//  250K Layers
/////////////////////////

      { id: '250K_linear', name: 'Linear', group: 'Geology (250K) WMS',
      url: 'https://map.bgs.ac.uk/arcgis/rest/services/GeoIndex_GSNI/GSNI_Geology_Landsat_WMS/MapServer/',
      layers: '8', opacity: 0.6, visible: true, attribution: '&copy; GSNI' },

      { id: '250K_superficial', name: 'Superficial', group: 'Geology (250K) WMS',
      url: 'https://map.bgs.ac.uk/arcgis/rest/services/GeoIndex_GSNI/GSNI_Geology_Landsat_WMS/MapServer/',
      layers: '9', opacity: 0.6, visible: true, attribution: '&copy; GSNI' },

      { id: '250K_bedrock', name: 'Bedrock', group: 'Geology (250K) WMS',
      url: 'https://map.bgs.ac.uk/arcgis/rest/services/GeoIndex_GSNI/GSNI_Geology_Landsat_WMS/MapServer/',
      layers: '10', opacity: 0.6, visible: true, attribution: '&copy; GSNI' },


/////////////////////////
//  Hydro Layers
/////////////////////////
      { id: 'Superficial Aquifer', name: 'Superficial Aquifer', group: 'Hydrogeology',
      url: 'https://map.bgs.ac.uk/arcgis/rest/services/GeoIndex_GSNI/GSNI_Hydrogeology/MapServer/',
      layers: '5', opacity: 0.6, visible: false, attribution: '&copy; GSNI' },

      { id: 'Bedrock Aquifer', name: 'Bedrock Aquifer', group: 'Hydrogeology',
      url: 'https://map.bgs.ac.uk/arcgis/rest/services/GeoIndex_GSNI/GSNI_Hydrogeology/MapServer/',
      layers: '4', opacity: 0.6, visible: false, attribution: '&copy; GSNI' },

      { id: 'Groundwater Vulnerability', name: 'Groundwater Vulnerability', group: 'Hydrogeology',
      url: 'https://map.bgs.ac.uk/arcgis/rest/services/GeoIndex_GSNI/GSNI_Hydrogeology/MapServer/',
      layers: '6', opacity: 0.6, visible: false, attribution: '&copy; GSNI' },


/////////////////////////
//  Geophysics Layers
/////////////////////////

    { id: 'gsni_pseudogravity', name: 'Pseudogravity', group: 'Geophysics',
      url: 'https://map.bgs.ac.uk/arcgis/rest/services/GeoIndex_GSNI/GSNI_Geophysics/MapServer/',
      layers: '4', opacity: 0.6, visible: false, attribution: '&copy; GSNI' },
    { id: 'gsni_rtp', name: 'Reduced to pole', group: 'Geophysics',
      url: 'https://map.bgs.ac.uk/arcgis/rest/services/GeoIndex_GSNI/GSNI_Geophysics/MapServer/',
      layers: '7', opacity: 0.6, visible: false, attribution: '&copy; GSNI' },
    { id: 'gsni_residual', name: 'Residual', group: 'Geophysics',
      url: 'https://map.bgs.ac.uk/arcgis/rest/services/GeoIndex_GSNI/GSNI_Geophysics/MapServer/',
      layers: '3', opacity: 0.6, visible: false, attribution: '&copy; GSNI' },
    { id: 'esri_world_imagery', name: 'ESRI World Imagery', group: 'Imagery',
      tiles: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      opacity: 0.6, visible: false,
      attribution: '&copy; Esri, Maxar, Earthstar Geographics, and the GIS User Community' }
    // WMS:  { id: 'w1', name: 'My WMS', url: 'https://example.org/wms', layers: 'geology_50k', version: '1.3.0' },
    // XYZ:  { id: 'x1', name: 'My tiles', tiles: 'https://example.org/{z}/{x}/{y}.png', maxzoom: 18 },
    // Optional on any overlay: group, opacity (0-1), visible (true/false), attribution, minzoom, maxzoom, legendUrl (image),
    //   info (https link shown as an 'i' link in the layer's panel)
  ],

  // Layer information (the "i" button on a layer). Key = vector layer name as in the legend, or an overlay id.
  //   { metadata: '<record url>' }  -> fetches the JSON record and shows `infoFields`; a link to the record page (without f=json) goes at the bottom.
  //   { metadata, fields: [...] }   -> same, but with this layer's own fields / order.   Optional: linkText, page (override the link target).
  //   'https://…'                   -> just an "About this layer" link inside the layer's panel.
  // The metadata server must allow cross-origin (CORS) requests from the site hosting this page.
  layerInfo: {
    Site_Reports: { metadata: 'https://gsni-data.bgs.ac.uk/geonetwork/api/collections/main/items/2bd4d1e5-9401-4da9-9566-f481b84fa110?f=json' },
    Boreholes: {metadata: 'https://gsni-data.bgs.ac.uk/geonetwork/api/collections/main/items/09757268-929d-4203-b1fc-56d9391e4688'} ,
  },
  // What to show from the record, in this order. Each item:
  //   label  – heading shown above the value (leave out for none)
  //   path   – where the value is in the JSON, e.g. 'properties.title' or 'properties.contacts[0].emails[0].value'
  //   format – optional: 'title' | 'date' | 'daterange' | 'scale' | 'list' | 'lines' | 'email' | 'link',
  //            or a function (value, wholeRecord) => text.  Plain text is the default; web addresses become links.
  // Items with no value in the record are skipped. Delete, reorder or add lines freely.
  infoFields: [
    { path: 'properties.title', format: 'title' },
    { label: 'Description', path: 'properties.description' },
    { label: 'Data period', path: 'time.interval', format: 'daterange' },
    { label: 'Last updated', path: 'properties.updated', format: 'date' },
    { label: 'Scale', path: 'properties.gn-elastic-index-record.resolutionScaleDenominator[0]', format: 'scale' },
    { label: 'Keywords', path: 'properties.keywords', format: 'list' },
    { label: 'Licence', path: 'properties.gn-elastic-index-record.otherProperties.licenseObject', format: 'lines' },
    { label: 'Contact', path: 'properties.contacts[0].organization' },
    { label: 'Email', path: 'properties.contacts[0].emails[0].value', format: 'email' }
  ],
  classToggles: { '*': true, 'Geology (Digital 10K)': false },   // tick boxes on each class, per layer ('*' = default). false = classes are shown as a key only; the layer's own box still controls it
  legendInView: 12,           // layers with more classes than this only list the classes present in the map view (0 = always list all)
  legendOther: false,         // true = also list the 'fallback' colour of a class-coloured layer as "Other"
  collapseLayers: false,      // true = start with each layer's classes collapsed
  search: { countrycodes: 'gb,ie', limit: 5 },   // place search (OpenStreetMap Nominatim); grid refs need no service


  // Themes: pick which layers are on. `layers` = legend layer names (as in the legend, with underscores),
  // `overlays` = overlay ids. Anything not listed is switched off. A theme with neither key shows everything.
    themes: [
    { name: 'Boreholes', layers: ['Boreholes', 'Site_Reports'], overlays: ['esri_world_imagery'] },
    { name: 'Geology', layers: ['10K_Bedrock', '10K_Superficial', '10K_Linear', '10K_Point_Data'] },
    { name: 'Geology WMS', overlays: ['10K_bedrock', '10K_superficial', '10K_linear', '10K_mass_movement', '10K_artificial','10k_landform', '250K_bedrock', '250K_superficial', '250K_linear','esri_world_imagery'] },
    { name: 'Geophysics', overlays: ['gsni_pseudogravity', 'gsni_rtp', 'gsni_residual', 'esri_world_imagery'] },
   // { name: 'Geochemistry', overlays: ['esri_world_imagery'] },
    { name: 'Hydrogeology', overlays: ['Bedrock Aquifer', 'Groundwater Vulnerability', 'Superficial Aquifer','esri_world_imagery'] },
   // { name: 'Minerals', overlays: ['esri_world_imagery'] },
   // { name: 'All layers' }
  ],


  defaultTheme: 0,            // index of the theme applied on load (remove `themes` to hide the drop-down)
  layerZooms: {},             // optional tile-zoom range per layer, e.g. { Boreholes: [10, 14] }
  legendLabels: {
    Boreholes_rule0: '0 – 5 m', Boreholes_rule2_3: '5 – 10 m', Boreholes_rule4_5: '10 – 20 m',
    Boreholes_rule6_7: '20 – 100 m', Boreholes_rule8_9: '> 100 m',
    Site_Reports_rule0: 'Site reports'
  },
  // 3D view + hillshade from Cloud Optimised GeoTIFFs: one band of elevation (metres), EPSG:3857, tiled with overviews.
  // Add models for a user-selectable list; each needs a unique id, display name and COG path.
  // The page must be served over http(s) (not opened from disk). Remove `terrain` to switch the 3D button and hillshade off.
  terrain: {
    models: [
      { id: '10m', name: 'Open 10m DEM', cog: 'https://data.better-open-data.com/lidar_zstd/DTM.tif', tileSize: 512 },
      { id: 'local', name: 'Local 10m DEM', cog: 'http://localhost:8000/DTM_local.tif', tileSize: 512, maxzoom: 24 }
    ],
    defaultModel: '10m', // selected initially; defaults to the first model
    exaggeration: 1.0,         // vertical exaggeration in the 3D view
    pitch: 60,                 // tilt when 3D is switched on (0-80)
    tileSize: 512,             // the COG's internal tile size (256 or 512)
    hillshade: true,           // add a "Hillshade (DTM)" layer to the legend (id 'hillshade', usable in themes)
    hillshadeVisible: true,   // start with the hillshade switched on?
    hillshadeStrength: 0.6,    // 0-1, shading strength at 0% transparency
    contours: {
      visible: true,
      opacity: 0.8,
      thresholds: {
        8: [100, 500], 9: [100, 500], 10: [100, 500], 11: [100, 500],
        12: [50, 250], 13: [20, 100], 14: [10, 50], 15: [10, 50], 16: [5, 25]
      }
    },
    allThemes: true            // hillshade + 3D tick boxes stay available in every theme (false = hillshade follows themes' `overlays`)
    // optional: hillshadeName, group, info (link or { metadata }), attribution
  },
  center: [-6.5, 54.6],       // [lon, lat]
  zoom: 8
};
