///////////////////////////////////////////////////////////////////////////
// APPLICATION CONFIGURATION
///////////////////////////////////////////////////////////////////////////

window.CONFIG = {
  title: 'MAPLIBRE DEMO',
  showZoom: true, // development helper: show the current zoom level beside the grid reference; set to false for production

///////////////////////////////////////////////////////////////////////////
//  Datasets - PMTILES
///////////////////////////////////////////////////////////////////////////
// Vector datasets: each has its own .pmtiles and style.json. Layers from all datasets share one legend.
//   id (unique) | style (style.json path) | pmtiles (optional: overrides the file named in that style) | name (optional legend group if the style has none)
// Themes can use `datasets: ['geol']` to switch on every layer from a dataset, and/or `
// layers: [...]` for individual layers.
// Remove `datasets` to use `styleUrl` alone.
///////////////////////////////////////////////////////////////////////////

  datasets: [
    { id: 'bores', name: 'Site Investigations', style: 'config/layers.json', pmtiles: 'data/layers.pmtiles' },
  //  { id: 'Geology', name: 'Geology', style: 'config/geology.json', pmtiles: 'data/layers.pmtiles' },

  ],
  styleUrl: 'config/style.json',

///////////////////////////////////////////////////////////////////////////
//  Query Layers 
//  null = auto-detect every layer on a vector source in your style; or list ids
///////////////////////////////////////////////////////////////////////////  
  queryLayers: null,          

///////////////////////////////////////////////////////////////////////////
//  Basemaps
///////////////////////////////////////////////////////////////////////////

  basemaps: [
    { id: 'osm', name: 'OpenStreetMap', tiles: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
      maxzoom: 19, attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors', opacity: 1, visible: true },
    { id: 'Gray', name: 'World Light Gray Base', tiles: 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}.png',
      maxzoom: 19, attribution: '&copy; ESRI', opacity: 1, visible: false }
  ],

///////////////////////////////////////////////////////////////////////////
//  Project Extent
///////////////////////////////////////////////////////////////////////////

  bounds: [[-8.5, 53.5], [-5.0, 55.6]], // project extent: southwest and northeast [longitude, latitude]

///////////////////////////////////////////////////////////////////////////
//  Layer Visibility on startup
///////////////////////////////////////////////////////////////////////////
  
  layerDefaults: {}, // vector source-layer names enabled at startup, e.g. { Boreholes: true }

///////////////////////////////////////////////////////////////////////////
//  Overlays XYZ / WMS etc
///////////////////////////////////////////////////////////////////////////
// WMS:  { id: 'w1', name: 'My WMS', url: 'https://example.org/wms', layers: 'geology_50k', version: '1.3.0' },
// XYZ:  { id: 'x1', name: 'My tiles', tiles: 'https://example.org/{z}/{x}/{y}.png', maxzoom: 18 },
// Optional on any overlay: group, opacity (0-1), visible (true/false), attribution, minzoom, maxzoom, legendUrl (image),
//   info (https link shown as an 'i' link in the layer's panel)
// For COGs, hillshade controls are hidden by default; set hillshade_option: true to show them and enable hillshade initially.

// GeoJSON outline (hollow line) layer, reprojected from Irish Grid:
//   { id: 'g1', name: 'My boundary', group: 'Boundaries', geojson: true, url: 'data/boundary.geojson', projection: 'EPSG:29902',
//     style: { color: '#d9480f', width: 2, dasharray: [4, 2] /* optional */ }, opacity: 1, visible: true },
// Points in the same file: style.radius (default 5) sets the dot size, style.fill its fill (default = color), color/width its outline.
///////////////////////////////////////////////////////////////////////////

  
overlays: [

///////////////////////////////////////////////////////////////////////////
//  Local COG raster
///////////////////////////////////////////////////////////////////////////

// { id: 'converted_cog', name: 'Converted COG', group: 'COG Rasters', cog: 'data/converted.tif', tileSize: 256, opacity: 1, visible: true },

{
  id: 'Magnetics Residual',
  name: 'Magnetics Residual',
  group: 'Tellus Magnetics',
  cog: 'https://data.better-open-data.com/lidar_zstd/TELLUS_Magnetic (Minc from V3 gdb, cellsize 35m) MAG_RES_cog.tif',
  legendunits: 'nT',
  tileSize: 256,
  opacity: 1,
  visible: false,
  hillshade_option: true
},

{
  id: 'Magnetics RTP',
  name: 'Magnetics RTP',
  group: 'Tellus Magnetics',
  cog: 'https://data.better-open-data.com/lidar_zstd/TELLUS_Magnetic (Minc from V3 gdb, cellsize 35m) MAG_RES - rtp_cog.tif',
  legendunits: 'nT',
  tileSize: 256,
  opacity: 1,
  visible: false,
  hillshade_option: true

},

{
  id: 'Magnetics RTP Tilt Derivative',
  name: 'Magnetics RTP Tilt Derivative',
  group: 'Tellus Magnetics',
  cog: 'https://data.better-open-data.com/lidar_zstd/TELLUS_Magnetic (Minc from V3 gdb, cellsize 35m) MAG_RES - rtp - TiltD_cog.tif',
  legendunits: 'nT',
  tileSize: 256,
  opacity: 1,
  visible: false,
  hillshade_option: true

},

{
  id: 'Magnetics Pseudo Gravity',
  name: 'Magnetics Pseudo Gravity',
  group: 'Tellus Magnetics',
  cog: 'https://data.better-open-data.com/lidar_zstd/TELLUS_Magnetic (Minc from V3 gdb, cellsize 35m) MAG_RES - psg_cog.tif',
  legendunits: 'nT',
  tileSize: 256,
  opacity: 1,
  visible: false
},

{
  id: 'Magnetics Pseudo Gravity Tilt Derivative',
  name: 'Magnetics Pseudo Gravity Tilt Derivative',
  group: 'Tellus Magnetics',
  cog: 'https://data.better-open-data.com/lidar_zstd/TELLUS_Magnetic (Minc from V3 gdb, cellsize 35m) MAG_RES - psg - TiltD_cog.tif',
  legendunits: 'nT',
  tileSize: 256,
  opacity: 1,
  visible: false
},

{
  id: 'High Frequency EM',
  name: 'High Frequency (14kHz) EM',
  group: 'Tellus Electromagnetics',
  cog: 'https://data.better-open-data.com/lidar_zstd/TELLUS_Electromagnetic (Minc from V3 gdb, cellsize 35m) 14KHz_Acon_FLT_cog.tif',
  legendunits: 'mS/m',
  tileSize: 256,
  opacity: 1,
  visible: false,
  hillshade_option: true
},

{
  id: 'Low Frequency EM',
  name: 'Low Frequency (3kHz) EM',
  group: 'Tellus Electromagnetics',
  cog: 'https://data.better-open-data.com/lidar_zstd/TELLUS_Electromagnetic (Minc from V3 gdb, cellsize 35m) 3KHz_Acon_FLT_cog.tif',
  legendunits: 'mS/m',
  tileSize: 256,
  opacity: 1,
  visible: false,
  hillshade_option: true
},

{
  id: 'Uranium',
  name: 'Uranium',
  group: 'Tellus Radiometrics',
  cog: 'https://data.better-open-data.com/lidar_zstd/TELLUS_Radiometric (Minc from V3 gdb, cellsize 35m) D_URA_1.tif',
  legendunits: 'ppm',
  tileSize: 256,
  opacity: 1,
  visible: false
},

{
  id: 'Thorium',
  name: 'Thorium',
  group: 'Tellus Radiometrics',
  cog: 'https://data.better-open-data.com/lidar_zstd/TELLUS_Radiometric (Minc from V3 gdb, cellsize 35m) D_THO_1.tif',
  legendunits: 'ppm',
  tileSize: 256,
  opacity: 1,
  visible: false
},

{
  id: 'Potassium',
  name: 'Potassium',
  group: 'Tellus Radiometrics',
  cog: 'https://data.better-open-data.com/lidar_zstd/TELLUS_Radiometric (Minc from V3 gdb, cellsize 35m) D_KAL_1.tif',
  legendunits: '%',
  tileSize: 256,
  opacity: 1,
  visible: false
},

{
  id: 'Total Count',
  name: 'Total Count',
  group: 'Tellus Radiometrics',
  cog: 'https://data.better-open-data.com/lidar_zstd/TELLUS_Radiometric (Minc from V3 gdb, cellsize 35m) D_TOT_CPS.tif',
  legendunits: 'cps',
  tileSize: 256,
  opacity: 1,
  visible: false,
  hillshade_option: true
},


///////////////////////////////////////////////////////////////////////////
//  10K Layers
///////////////////////////////////////////////////////////////////////////

{ id: '10K_landform', name: 'Landform', group: 'Geology (10K) WMS',
url: 'https://map.bgs.ac.uk/arcgis/rest/services/GeoIndex_GSNI/GSNI_Geology_Landsat_WMS/MapServer/',
layers: '1', opacity: 0.6, visible: false, attribution: '&copy; GSNI' },

{ id: '10K_linear', name: 'Linear', group: 'Geology (10K) WMS',
url: 'https://map.bgs.ac.uk/arcgis/rest/services/GeoIndex_GSNI/GSNI_Geology_Landsat_WMS/MapServer/',
layers: '2', opacity: 0.6, visible: false, attribution: '&copy; GSNI' },

{ id: '10K_mass_movement', name: 'Mass Movement', group: 'Geology (10K) WMS',
url: 'https://map.bgs.ac.uk/arcgis/rest/services/GeoIndex_GSNI/GSNI_Geology_Landsat_WMS/MapServer/',
layers: '3', opacity: 0.6, visible: false, attribution: '&copy; GSNI' },

{ id: '10K_artificial', name: 'Artificial', group: 'Geology (10K) WMS',
url: 'https://map.bgs.ac.uk/arcgis/rest/services/GeoIndex_GSNI/GSNI_Geology_Landsat_WMS/MapServer/',
layers: '4', opacity: 0.6, visible: false, attribution: '&copy; GSNI' },

{ id: '10K_superficial', name: 'Superficial', group: 'Geology (10K) WMS',
url: 'https://map.bgs.ac.uk/arcgis/rest/services/GeoIndex_GSNI/GSNI_Geology_Landsat_WMS/MapServer/',
layers: '5', opacity: 0.6, visible: false, attribution: '&copy; GSNI' },

{ id: '10K_bedrock', name: 'Bedrock', group: 'Geology (10K) WMS',
url: 'https://map.bgs.ac.uk/arcgis/rest/services/GeoIndex_GSNI/GSNI_Geology_Landsat_WMS/MapServer/',
layers: '6', opacity: 0.6, visible: false, attribution: '&copy; GSNI' },


///////////////////////////////////////////////////////////////////////////
//  250K Layers
///////////////////////////////////////////////////////////////////////////

{ id: '250K_linear', name: 'Linear', group: 'Geology (250K) WMS',
url: 'https://map.bgs.ac.uk/arcgis/rest/services/GeoIndex_GSNI/GSNI_Geology_Landsat_WMS/MapServer/',
layers: '8', opacity: 0.6, visible: false, attribution: '&copy; GSNI' },

{ id: '250K_superficial', name: 'Superficial', group: 'Geology (250K) WMS',
url: 'https://map.bgs.ac.uk/arcgis/rest/services/GeoIndex_GSNI/GSNI_Geology_Landsat_WMS/MapServer/',
layers: '9', opacity: 0.6, visible: false, attribution: '&copy; GSNI' },

{ id: '250K_bedrock', name: 'Bedrock', group: 'Geology (250K) WMS',
url: 'https://map.bgs.ac.uk/arcgis/rest/services/GeoIndex_GSNI/GSNI_Geology_Landsat_WMS/MapServer/',
layers: '10', opacity: 0.6, visible: false, attribution: '&copy; GSNI' },


///////////////////////////////////////////////////////////////////////////
//  Hydro Layers
///////////////////////////////////////////////////////////////////////////
{ id: 'Superficial Aquifer', name: 'Superficial Aquifer', group: 'Hydrogeology',
url: 'https://map.bgs.ac.uk/arcgis/rest/services/GeoIndex_GSNI/GSNI_Hydrogeology/MapServer/',
layers: '5', opacity: 0.6, visible: false, attribution: '&copy; GSNI' },

{ id: 'Bedrock Aquifer', name: 'Bedrock Aquifer', group: 'Hydrogeology',
url: 'https://map.bgs.ac.uk/arcgis/rest/services/GeoIndex_GSNI/GSNI_Hydrogeology/MapServer/',
layers: '4', opacity: 0.6, visible: false, attribution: '&copy; GSNI' },

{ id: 'Groundwater Vulnerability', name: 'Groundwater Vulnerability', group: 'Hydrogeology',
url: 'https://map.bgs.ac.uk/arcgis/rest/services/GeoIndex_GSNI/GSNI_Hydrogeology/MapServer/',
layers: '6', opacity: 0.6, visible: false, attribution: '&copy; GSNI' },


///////////////////////////////////////////////////////////////////////////
//  Geophysics Layers
///////////////////////////////////////////////////////////////////////////

{ id: 'gsni_residual', name: 'Residual', group: 'Geophysics - Magnetics',
url: 'https://map.bgs.ac.uk/arcgis/rest/services/GeoIndex_GSNI/GSNI_Geophysics/MapServer/',
layers: '3', opacity: 0.6, visible: false, attribution: '&copy; GSNI' },
{ id: 'gsni_pseudogravity', name: 'Pseudogravity', group: 'Geophysics - Magnetics',
url: 'https://map.bgs.ac.uk/arcgis/rest/services/GeoIndex_GSNI/GSNI_Geophysics/MapServer/',
layers: '4', opacity: 0.6, visible: false, attribution: '&copy; GSNI' },
{ id: 'Pseudogravity - Tilt Derivative ', name: 'Pseudogravity - Tilt Derivative ', group: 'Geophysics - Magnetics',
url: 'https://map.bgs.ac.uk/arcgis/rest/services/GeoIndex_GSNI/GSNI_Geophysics/MapServer/',
layers: '5', opacity: 0.6, visible: false, attribution: '&copy; GSNI' },
{ id: 'Analytic_Signal', name: 'Analytic_Signal', group: 'Geophysics - Magnetics',
url: 'https://map.bgs.ac.uk/arcgis/rest/services/GeoIndex_GSNI/GSNI_Geophysics/MapServer/',
layers: '6', opacity: 0.6, visible: false, attribution: '&copy; GSNI' },
{ id: 'gsni_rtp', name: 'Reduced to pole', group: 'Geophysics - Magnetics',
url: 'https://map.bgs.ac.uk/arcgis/rest/services/GeoIndex_GSNI/GSNI_Geophysics/MapServer/',
layers: '7', opacity: 0.6, visible: false, attribution: '&copy; GSNI' },
{ id: 'Reduced_to_Pole - Tilt Derivative ', name: 'Reduced_to_Pole - Tilt Derivative', group: 'Geophysics - Magnetics',
url: 'https://map.bgs.ac.uk/arcgis/rest/services/GeoIndex_GSNI/GSNI_Geophysics/MapServer/',
layers: '8', opacity: 0.6, visible: false, attribution: '&copy; GSNI' },
{ id: 'RTP - Analytic_Signal ', name: 'RTP - Analytic_Signal', group: 'Geophysics - Magnetics',
url: 'https://map.bgs.ac.uk/arcgis/rest/services/GeoIndex_GSNI/GSNI_Geophysics/MapServer/',
layers: '9', opacity: 0.6, visible: false, attribution: '&copy; GSNI' },


{ id: 'High Frequency Apparent Conductivity', name: 'High Frequency Apparent Conductivity', group: 'Geophysics - Electromagnetics',
url: 'https://map.bgs.ac.uk/arcgis/rest/services/GeoIndex_GSNI/GSNI_Geophysics/MapServer/',
layers: '11', opacity: 0.6, visible: false, attribution: '&copy; GSNI' },
{ id: 'Low Frequency Apparent Conductivity ', name: 'Low Frequency Apparent Conductivity', group: 'Geophysics - Electromagnetics',
url: 'https://map.bgs.ac.uk/arcgis/rest/services/GeoIndex_GSNI/GSNI_Geophysics/MapServer/',
layers: '12', opacity: 0.6, visible: false, attribution: '&copy; GSNI' },


{ id: 'Ratio eTh - K', name: 'Ratio eTh - K', group: 'Geophysics - Radiometrics',
url: 'https://map.bgs.ac.uk/arcgis/rest/services/GeoIndex_GSNI/GSNI_Geophysics/MapServer/',
layers: '14', opacity: 0.6, visible: false, attribution: '&copy; GSNI' },
{ id: 'Ratio eU - eTh', name: 'Ratio eU - eTh', group: 'Geophysics - Radiometrics',
url: 'https://map.bgs.ac.uk/arcgis/rest/services/GeoIndex_GSNI/GSNI_Geophysics/MapServer/',
layers: '15', opacity: 0.6, visible: false, attribution: '&copy; GSNI' },
{ id: 'Ratio eU - K', name: 'Ratio eU - K', group: 'Geophysics - Radiometrics',
url: 'https://map.bgs.ac.uk/arcgis/rest/services/GeoIndex_GSNI/GSNI_Geophysics/MapServer/',
layers: '16', opacity: 0.6, visible: false, attribution: '&copy; GSNI' },
{ id: 'Ternary K - Th - U', name: 'Ternary K - Th - U', group: 'Geophysics - Radiometrics',
url: 'https://map.bgs.ac.uk/arcgis/rest/services/GeoIndex_GSNI/GSNI_Geophysics/MapServer/',
layers: '17', opacity: 0.6, visible: false, attribution: '&copy; GSNI' },
{ id: 'Potassium', name: 'Potassium', group: 'Geophysics - Radiometrics',
url: 'https://map.bgs.ac.uk/arcgis/rest/services/GeoIndex_GSNI/GSNI_Geophysics/MapServer/',
layers: '18', opacity: 0.6, visible: false, attribution: '&copy; GSNI' },
{ id: 'Thorium', name: 'Thorium', group: 'Geophysics - Radiometrics',
url: 'https://map.bgs.ac.uk/arcgis/rest/services/GeoIndex_GSNI/GSNI_Geophysics/MapServer/',
layers: '19', opacity: 0.6, visible: false, attribution: '&copy; GSNI' },
{ id: 'Total Count', name: 'Total Count', group: 'Geophysics - Radiometrics',
url: 'https://map.bgs.ac.uk/arcgis/rest/services/GeoIndex_GSNI/GSNI_Geophysics/MapServer/',
layers: '10', opacity: 0.6, visible: false, attribution: '&copy; GSNI' },


///////////////////////////////////////////////////////////////////////////
//  Imagery Layers
///////////////////////////////////////////////////////////////////////////

 { id: 'lot1_ortho_ni', name: 'NI Coastal Orthophotography', group: 'Imagery',
tiles: 'https://tiles-eu1.arcgis.com/kswen6BYexuc1SUk/arcgis/rest/services/Lot1_Ortho_NI/MapServer/tile/{z}/{y}/{x}?cacheKey=b4dc3f34e50f87a9',
maxzoom: 23, opacity: 1, visible: false, attribution: '&copy; DAERA, Bluesky' },

{ id: 'esri_world_imagery', name: 'ESRI World Imagery', group: 'Imagery',
tiles: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
opacity: 0.6, visible: false,
attribution: '&copy; Esri, Maxar, Earthstar Geographics, and the GIS User Community' }
],
///////////////////////////////////////////////////////////////////////////
//  Groups
///////////////////////////////////////////////////////////////////////////
// Named collections of datasets, vector layers, overlays and other groups, for use in a theme's `groups: [...]`.
//   'Name': { datasets: [ids], layers: [source-layer names], overlays: [ids], groups: [other group names] }
///////////////////////////////////////////////////////////////////////////

  groups: {
    'A Test Group': { overlays: ['gsni_pseudogravity', 'Bedrock Aquifer'] },
  },


///////////////////////////////////////////////////////////////////////////
//  Linked JSON data
///////////////////////////////////////////////////////////////////////////
// Joins JSON files to a vector layer. Matching rows appear in the click popup and as extra tabs in the results table.
//   'Layer name': { field: attribute on the layer, links: [{ label, file, dataKey (array in the file; default first array), field (column in the file; default = layer field) }] }
///////////////////////////////////////////////////////////////////////////

  dataLinks: {
    Boreholes: {
      field: 'OBJECTID',
      links: [
        { label: 'Samples', file: 'data/site-investigations/samples.json', dataKey: 'si_samples' },
        { label: 'Strata', file: 'data/site-investigations/strata.json', dataKey: 'si_strata' }
      ]
    }
  },

///////////////////////////////////////////////////////////////////////////
//  Layer Metadata
///////////////////////////////////////////////////////////////////////////
// Layer information (the "i" button on a layer). Key = vector layer name as in the legend, or an overlay id.
//   { metadata: '<record url>' }  -> fetches the JSON record and shows `infoFields`; a link to the record page (without f=json) goes at the bottom.
//   { metadata, fields: [...] }   -> same, but with this layer's own fields / order.   Optional: linkText, page (override the link target).
//   'https://…'                   -> just an "About this layer" link inside the layer's panel.
// The metadata server must allow cross-origin (CORS) requests from the site hosting this page.
///////////////////////////////////////////////////////////////////////////

  layerInfo: {
    Site_Reports: { metadata: 'https://gsni-data.bgs.ac.uk/geonetwork/api/collections/main/items/2bd4d1e5-9401-4da9-9566-f481b84fa110?f=json' },
    Boreholes: {metadata: 'https://gsni-data.bgs.ac.uk/geonetwork/api/collections/main/items/09757268-929d-4203-b1fc-56d9391e4688?f=json'} ,
  },

  // Group-level information: key = group name exactly as shown in the legend (overlay `group`, or a vector legend group).
  // Same formats as layerInfo. Every layer in the group shows it unless the layer has its own entry in layerInfo (or `info`).
  groupInfo: {
    'Tellus Magnetics': { metadata: 'https://gsni-data.bgs.ac.uk/geonetwork/api/collections/main/items/43e0d940-c82e-40bb-abc0-a775158500b5?f=json' },
    'Geophysics - Magnetics': { metadata: 'https://gsni-data.bgs.ac.uk/geonetwork/api/collections/main/items/43e0d940-c82e-40bb-abc0-a775158500b5?f=json' },
    'Geophysics - Electromagnetics': { metadata: 'https://gsni-data.bgs.ac.uk/geonetwork/api/collections/main/items/43e0d940-c82e-40bb-abc0-a775158500b5?f=json' },
    'Geophysics - Radiometrics': { metadata: 'https://gsni-data.bgs.ac.uk/geonetwork/api/collections/main/items/43e0d940-c82e-40bb-abc0-a775158500b5?f=json' },
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

///////////////////////////////////////////////////////////////////////////
// Theme Configuration
///////////////////////////////////////////////////////////////////////////
// Themes: pick which layers are on. `layers` = source-layer names,
// `groups` = style groups, overlay groups, or named themes; `datasets` = dataset ids,
// and `overlays` = overlay ids. Anything not listed is switched off. A theme with no keys shows everything.
// Groups may name a style group, configured overlay group, or named theme.
// Examples: ['Geotechnical'], ['Geology (10K) WMS'], or ['Geology WMS'].
// `showResults: true` opens the results table when the theme loads (default off; queries always open it).
///////////////////////////////////////////////////////////////////////////

    themes: [
    { name: 'Site Investigations',
      layers: ['Boreholes', 'Site_Reports'], //pmtiles
      overlays: ['esri_world_imagery', 'lot1_ortho_ni'] },
    { name: 'Geology',
      layers: ['10K_Bedrock', '10K_Superficial', '10K_Linear', '10K_Point_Data'] }, //pmtiles
    { name: 'Geology WMS',
      overlays: ['10K_bedrock', '10K_superficial', '10K_linear', '10K_mass_movement', '10K_artificial','10K_landform', '250K_bedrock', '250K_superficial', '250K_linear','esri_world_imagery'] },
    { name: 'Geophysics WMS',
      overlays: ['Geophysics - Magnetics','Geophysics - Electromagnetics','Geophysics - Radiometrics', 'esri_world_imagery'] },
    { name: 'Tellus Geophysics',
      overlays: ['Tellus Magnetics', 'Tellus Electromagnetics','Tellus Radiometrics','esri_world_imagery'] },
    { name: 'Hydrogeology',
      overlays: ['Bedrock Aquifer', 'Groundwater Vulnerability', 'Superficial Aquifer', 'esri_world_imagery'] },
    { name: 'Minerals',
      groups: ['Geology WMS'],
      overlays: ['esri_world_imagery'] },
    { name: 'Geomaterials',
      jsonTheme: 'geomaterials',
      jsonConfig: 'config/config_geomaterials.js',
      groups: ['Geology WMS'] },
    { name: 'Test Deployment',
      jsonTheme: 'test-deployment',
      jsonConfig: 'config/config_test_deployment.js',
      groups: ['A Test Group']},
    { name: 'Site Investigations (JSON)',
      jsonTheme: 'site-investigations',
      jsonConfig: 'config/config_site_investigations.js',
      datasets: ['bores'] },   // the geometry dataset must be on so its tiles load

   // { name: 'All layers' }
  ],


///////////////////////////////////////////////////////////////////////////
//  Default theme when the project loads
///////////////////////////////////////////////////////////////////////////
  defaultTheme: 0,

///////////////////////////////////////////////////////////////////////////
//  Set Visibility for pmtiles layers
///////////////////////////////////////////////////////////////////////////
  layerZooms: {},             // optional tile-zoom range per layer, e.g. { Boreholes: [10, 14] }

///////////////////////////////////////////////////////////////////////////
//  Nice Legend Labels - might remove these when the pmtiles style.json is configured
///////////////////////////////////////////////////////////////////////////

  legendLabels: {
    Boreholes_rule0: '0 – 5 m', Boreholes_rule2_3: '5 – 10 m', Boreholes_rule4_5: '10 – 20 m',
    Boreholes_rule6_7: '20 – 100 m', Boreholes_rule8_9: '> 100 m',
    Site_Reports_rule0: 'Site reports'
  },

///////////////////////////////////////////////////////////////////////////
//  Terrain Models
///////////////////////////////////////////////////////////////////////////
// 3D view + hillshade from Cloud Optimised GeoTIFFs: one band of elevation (metres), EPSG:3857, tiled with overviews.
// Add models for a user-selectable list; each needs a unique id, display name and COG path.
// The page must be served over http(s) (not opened from disk). Remove `terrain` to switch the 3D button and hillshade off.
///////////////////////////////////////////////////////////////////////////

  terrain: {
    models: [
      { id: '10m', name: 'Open 10m DEM', cog: 'https://data.better-open-data.com/lidar_zstd/DTM.tif', tileSize: 512 },
      { id: 'Ardquin_DSM', name: 'Ardquin_DSM', cog: 'https://data.better-open-data.com/lidar_zstd/Ardquin_DSM.tif', tileSize: 256, maxzoom: 16 },
      { id: 'Ardquin_DTM', name: 'Ardquin_DTM', cog: 'https://data.better-open-data.com/lidar_zstd/Ardquin_DTM.tif', tileSize: 256, maxzoom: 16 },
      { id: 'Ardstraw_02_02_2012_DSM', name: 'Ardstraw_02_02_2012_DSM', cog: 'https://data.better-open-data.com/lidar_zstd/Ardstraw_02_02_2012_DSM.tif', tileSize: 256, maxzoom: 16 },
      { id: 'Ardstraw_02_02_2012_DTM', name: 'Ardstraw_02_02_2012_DTM', cog: 'https://data.better-open-data.com/lidar_zstd/Ardstraw_02_02_2012_DTM.tif', tileSize: 256, maxzoom: 16 },
      { id: 'Ardtole_DSM', name: 'Ardtole_DSM', cog: 'https://data.better-open-data.com/lidar_zstd/Ardtole_DSM.tif', tileSize: 256, maxzoom: 16 },
      { id: 'Ardtole_DTM', name: 'Ardtole_DTM', cog: 'https://data.better-open-data.com/lidar_zstd/Ardtole_DTM.tif', tileSize: 256, maxzoom: 16 },
      { id: 'Armagh-Dungannon-Coalisland_15_03_2010_DTM', name: 'Armagh-Dungannon-Coalisland_15_03_2010_DTM', cog: 'https://data.better-open-data.com/lidar_zstd/Armagh-Dungannon-Coalisland_15_03_2010_DTM.tif', tileSize: 256, maxzoom: 16 },
      { id: 'Ballinamallard_05_03_2012_DSM', name: 'Ballinamallard_05_03_2012_DSM', cog: 'https://data.better-open-data.com/lidar_zstd/Ballinamallard_05_03_2012_DSM.tif', tileSize: 256, maxzoom: 16 },
      { id: 'Ballinamallard_05_03_2012_DTM', name: 'Ballinamallard_05_03_2012_DTM', cog: 'https://data.better-open-data.com/lidar_zstd/Ballinamallard_05_03_2012_DTM.tif', tileSize: 256, maxzoom: 16 },
      { id: 'Ballycastle_15_03_2010_DTM', name: 'Ballycastle_15_03_2010_DTM', cog: 'https://data.better-open-data.com/lidar_zstd/Ballycastle_15_03_2010_DTM.tif', tileSize: 256, maxzoom: 16 },
      { id: 'Ballyclare_23_04_2009_DTM', name: 'Ballyclare_23_04_2009_DTM', cog: 'https://data.better-open-data.com/lidar_zstd/Ballyclare_23_04_2009_DTM.tif', tileSize: 256, maxzoom: 16 },
      { id: 'Ballygalley_15_03_2010_DTM', name: 'Ballygalley_15_03_2010_DTM', cog: 'https://data.better-open-data.com/lidar_zstd/Ballygalley_15_03_2010_DTM.tif', tileSize: 256, maxzoom: 16 },
      { id: 'Ballygowan_15_03_2010_DTM', name: 'Ballygowan_15_03_2010_DTM', cog: 'https://data.better-open-data.com/lidar_zstd/Ballygowan_15_03_2010_DTM.tif', tileSize: 256, maxzoom: 16 },
      { id: 'Ballymena_23_04_2009_DSM', name: 'Ballymena_23_04_2009_DSM', cog: 'https://data.better-open-data.com/lidar_zstd/Ballymena_23_04_2009_DSM.tif', tileSize: 256, maxzoom: 16 },
      { id: 'Ballymena_23_04_2009_DTM', name: 'Ballymena_23_04_2009_DTM', cog: 'https://data.better-open-data.com/lidar_zstd/Ballymena_23_04_2009_DTM.tif', tileSize: 256, maxzoom: 16 },
      { id: 'Ballynahinch_15_03_2010_DTM', name: 'Ballynahinch_15_03_2010_DTM', cog: 'https://data.better-open-data.com/lidar_zstd/Ballynahinch_15_03_2010_DTM.tif', tileSize: 256, maxzoom: 16 },
      { id: 'Ballynavally_04_04_2007_DTM', name: 'Ballynavally_04_04_2007_DTM', cog: 'https://data.better-open-data.com/lidar_zstd/Ballynavally_04_04_2007_DTM.tif', tileSize: 256, maxzoom: 16 },
      { id: 'Banbridge_15_03_2010_DTM', name: 'Banbridge_15_03_2010_DTM', cog: 'https://data.better-open-data.com/lidar_zstd/Banbridge_15_03_2010_DTM.tif', tileSize: 256, maxzoom: 16 },
      { id: 'Bangor_04_04_2007_DTM', name: 'Bangor_04_04_2007_DTM', cog: 'https://data.better-open-data.com/lidar_zstd/Bangor_04_04_2007_DTM.tif', tileSize: 256, maxzoom: 16 },
      { id: 'Bangor_Extension_05_03_2012_DSM', name: 'Bangor_Extension_05_03_2012_DSM', cog: 'https://data.better-open-data.com/lidar_zstd/Bangor_Extension_05_03_2012_DSM.tif', tileSize: 256, maxzoom: 16 },
      { id: 'Bangor_Extension_05_03_2012_DTM', name: 'Bangor_Extension_05_03_2012_DTM', cog: 'https://data.better-open-data.com/lidar_zstd/Bangor_Extension_05_03_2012_DTM.tif', tileSize: 256, maxzoom: 16 },
      { id: 'Belfast_2006_DSM', name: 'Belfast_2006_DSM', cog: 'https://data.better-open-data.com/lidar_zstd/Belfast_2006_DSM.tif', tileSize: 256, maxzoom: 16 },
      { id: 'Belfast_2006_DTM', name: 'Belfast_2006_DTM', cog: 'https://data.better-open-data.com/lidar_zstd/Belfast_2006_DTM.tif', tileSize: 256, maxzoom: 16 },
      { id: 'Belleek_05_03_2012_DSM', name: 'Belleek_05_03_2012_DSM', cog: 'https://data.better-open-data.com/lidar_zstd/Belleek_05_03_2012_DSM.tif', tileSize: 256, maxzoom: 16 },
      { id: 'Belleek_05_03_2012_DTM', name: 'Belleek_05_03_2012_DTM', cog: 'https://data.better-open-data.com/lidar_zstd/Belleek_05_03_2012_DTM.tif', tileSize: 256, maxzoom: 16 },
      { id: 'Beragh_02_02_2012_DSM', name: 'Beragh_02_02_2012_DSM', cog: 'https://data.better-open-data.com/lidar_zstd/Beragh_02_02_2012_DSM.tif', tileSize: 256, maxzoom: 16 },
      { id: 'Beragh_02_02_2012_DTM', name: 'Beragh_02_02_2012_DTM', cog: 'https://data.better-open-data.com/lidar_zstd/Beragh_02_02_2012_DTM.tif', tileSize: 256, maxzoom: 16 },
      { id: 'Black_Pigs_Dyke_DSM', name: 'Black_Pigs_Dyke_DSM', cog: 'https://data.better-open-data.com/lidar_zstd/Black_Pigs_Dyke_DSM.tif', tileSize: 256, maxzoom: 16 },
      { id: 'Black_Pigs_Dyke_DTM', name: 'Black_Pigs_Dyke_DTM', cog: 'https://data.better-open-data.com/lidar_zstd/Black_Pigs_Dyke_DTM.tif', tileSize: 256, maxzoom: 16 },
      { id: 'Blackwater_16_06_2014_DSM', name: 'Blackwater_16_06_2014_DSM', cog: 'https://data.better-open-data.com/lidar_zstd/Blackwater_16_06_2014_DSM.tif', tileSize: 256, maxzoom: 16 },
      { id: 'Blackwater_16_06_2014_DTM', name: 'Blackwater_16_06_2014_DTM', cog: 'https://data.better-open-data.com/lidar_zstd/Blackwater_16_06_2014_DTM.tif', tileSize: 256, maxzoom: 16 },
      { id: 'Bonamargy_DSM', name: 'Bonamargy_DSM', cog: 'https://data.better-open-data.com/lidar_zstd/Bonamargy_DSM.tif', tileSize: 256, maxzoom: 16 },
      { id: 'Bonamargy_DTM', name: 'Bonamargy_DTM', cog: 'https://data.better-open-data.com/lidar_zstd/Bonamargy_DTM.tif', tileSize: 256, maxzoom: 16 },
      { id: 'Burren_03_03_2012_DSM', name: 'Burren_03_03_2012_DSM', cog: 'https://data.better-open-data.com/lidar_zstd/Burren_03_03_2012_DSM.tif', tileSize: 256, maxzoom: 16 },
      { id: 'Burren_03_03_2012_DTM', name: 'Burren_03_03_2012_DTM', cog: 'https://data.better-open-data.com/lidar_zstd/Burren_03_03_2012_DTM.tif', tileSize: 256, maxzoom: 16 },
      { id: 'Bushmills_15_03_2010_DTM', name: 'Bushmills_15_03_2010_DTM', cog: 'https://data.better-open-data.com/lidar_zstd/Bushmills_15_03_2010_DTM.tif', tileSize: 256, maxzoom: 16 },
      { id: 'Cahery_DSM', name: 'Cahery_DSM', cog: 'https://data.better-open-data.com/lidar_zstd/Cahery_DSM.tif', tileSize: 256, maxzoom: 16 },
      { id: 'Cahery_DTM', name: 'Cahery_DTM', cog: 'https://data.better-open-data.com/lidar_zstd/Cahery_DTM.tif', tileSize: 256, maxzoom: 16 },
      { id: 'Camowen_16_06_2014_DSM', name: 'Camowen_16_06_2014_DSM', cog: 'https://data.better-open-data.com/lidar_zstd/Camowen_16_06_2014_DSM.tif', tileSize: 256, maxzoom: 16 },
      { id: 'Camowen_16_06_2014_DTM', name: 'Camowen_16_06_2014_DTM', cog: 'https://data.better-open-data.com/lidar_zstd/Camowen_16_06_2014_DTM.tif', tileSize: 256, maxzoom: 16 },
      { id: 'Carrickfergus_04_04_2007_DTM', name: 'Carrickfergus_04_04_2007_DTM', cog: 'https://data.better-open-data.com/lidar_zstd/Carrickfergus_04_04_2007_DTM.tif', tileSize: 256, maxzoom: 16 },
      { id: 'Carryduff_15_03_2010_DTM', name: 'Carryduff_15_03_2010_DTM', cog: 'https://data.better-open-data.com/lidar_zstd/Carryduff_15_03_2010_DTM.tif', tileSize: 256, maxzoom: 16 },
      { id: 'Castlederg_23_05_2004_DSM', name: 'Castlederg_23_05_2004_DSM', cog: 'https://data.better-open-data.com/lidar_zstd/Castlederg_23_05_2004_DSM.tif', tileSize: 256, maxzoom: 16 },
      { id: 'Castlederg_23_05_2004_DTM', name: 'Castlederg_23_05_2004_DTM', cog: 'https://data.better-open-data.com/lidar_zstd/Castlederg_23_05_2004_DTM.tif', tileSize: 256, maxzoom: 16 },
      { id: 'Castlereagh_04_04_2007_DTM', name: 'Castlereagh_04_04_2007_DTM', cog: 'https://data.better-open-data.com/lidar_zstd/Castlereagh_04_04_2007_DTM.tif', tileSize: 256, maxzoom: 16 },
      { id: 'Cave_Hill_DSM', name: 'Cave_Hill_DSM', cog: 'https://data.better-open-data.com/lidar_zstd/Cave_Hill_DSM.tif', tileSize: 256, maxzoom: 16 },
      { id: 'Cave_Hill_DTM', name: 'Cave_Hill_DTM', cog: 'https://data.better-open-data.com/lidar_zstd/Cave_Hill_DTM.tif', tileSize: 256, maxzoom: 16 },
      { id: 'Charlemont_DSM', name: 'Charlemont_DSM', cog: 'https://data.better-open-data.com/lidar_zstd/Charlemont_DSM.tif', tileSize: 256, maxzoom: 16 },
      { id: 'Charlemont_DTM', name: 'Charlemont_DTM', cog: 'https://data.better-open-data.com/lidar_zstd/Charlemont_DTM.tif', tileSize: 256, maxzoom: 16 },
      { id: 'Clady_10_03_2009_DSM', name: 'Clady_10_03_2009_DSM', cog: 'https://data.better-open-data.com/lidar_zstd/Clady_10_03_2009_DSM.tif', tileSize: 256, maxzoom: 16 },
      { id: 'Clady_10_03_2009_DTM', name: 'Clady_10_03_2009_DTM', cog: 'https://data.better-open-data.com/lidar_zstd/Clady_10_03_2009_DTM.tif', tileSize: 256, maxzoom: 16 },
      { id: 'Clandeboye_DSM', name: 'Clandeboye_DSM', cog: 'https://data.better-open-data.com/lidar_zstd/Clandeboye_DSM.tif', tileSize: 256, maxzoom: 16 },
      { id: 'Clandeboye_DTM', name: 'Clandeboye_DTM', cog: 'https://data.better-open-data.com/lidar_zstd/Clandeboye_DTM.tif', tileSize: 256, maxzoom: 16 },
      { id: 'Clogher_DSM', name: 'Clogher_DSM', cog: 'https://data.better-open-data.com/lidar_zstd/Clogher_DSM.tif', tileSize: 256, maxzoom: 16 },
      { id: 'Clogher_DTM', name: 'Clogher_DTM', cog: 'https://data.better-open-data.com/lidar_zstd/Clogher_DTM.tif', tileSize: 256, maxzoom: 16 },
      { id: 'Cloghmills_16_06_2014_DSM', name: 'Cloghmills_16_06_2014_DSM', cog: 'https://data.better-open-data.com/lidar_zstd/Cloghmills_16_06_2014_DSM.tif', tileSize: 256, maxzoom: 16 },
      { id: 'Cloghmills_16_06_2014_DTM', name: 'Cloghmills_16_06_2014_DTM', cog: 'https://data.better-open-data.com/lidar_zstd/Cloghmills_16_06_2014_DTM.tif', tileSize: 256, maxzoom: 16 },
      { id: 'Coleraine-Portstewart-Portrush_15_03_2010_DTM', name: 'Coleraine-Portstewart-Portrush_15_03_2010_DTM', cog: 'https://data.better-open-data.com/lidar_zstd/Coleraine-Portstewart-Portrush_15_03_2010_DTM.tif', tileSize: 256, maxzoom: 16 },
      { id: 'Cookstown_06_06_2013_DSM', name: 'Cookstown_06_06_2013_DSM', cog: 'https://data.better-open-data.com/lidar_zstd/Cookstown_06_06_2013_DSM.tif', tileSize: 256, maxzoom: 16 },
      { id: 'Cookstown_06_06_2013_DTM', name: 'Cookstown_06_06_2013_DTM', cog: 'https://data.better-open-data.com/lidar_zstd/Cookstown_06_06_2013_DTM.tif', tileSize: 256, maxzoom: 16 },
      { id: 'Cornashee_DSM', name: 'Cornashee_DSM', cog: 'https://data.better-open-data.com/lidar_zstd/Cornashee_DSM.tif', tileSize: 256, maxzoom: 16 },
      { id: 'Cornashee_DTM', name: 'Cornashee_DTM', cog: 'https://data.better-open-data.com/lidar_zstd/Cornashee_DTM.tif', tileSize: 256, maxzoom: 16 },
      { id: 'Crossmurrin_DSM', name: 'Crossmurrin_DSM', cog: 'https://data.better-open-data.com/lidar_zstd/Crossmurrin_DSM.tif', tileSize: 256, maxzoom: 16 },
      { id: 'Crossmurrin_DTM', name: 'Crossmurrin_DTM', cog: 'https://data.better-open-data.com/lidar_zstd/Crossmurrin_DTM.tif', tileSize: 256, maxzoom: 16 },
      { id: 'Cullybackey_15_03_2010_DTM', name: 'Cullybackey_15_03_2010_DTM', cog: 'https://data.better-open-data.com/lidar_zstd/Cullybackey_15_03_2010_DTM.tif', tileSize: 256, maxzoom: 16 },
      { id: 'Cushendall_15_03_2010_DTM', name: 'Cushendall_15_03_2010_DTM', cog: 'https://data.better-open-data.com/lidar_zstd/Cushendall_15_03_2010_DTM.tif', tileSize: 256, maxzoom: 16 },
      { id: 'Devenish_DSM', name: 'Devenish_DSM', cog: 'https://data.better-open-data.com/lidar_zstd/Devenish_DSM.tif', tileSize: 256, maxzoom: 16 },
      { id: 'Devenish_DTM', name: 'Devenish_DTM', cog: 'https://data.better-open-data.com/lidar_zstd/Devenish_DTM.tif', tileSize: 256, maxzoom: 16 },
      { id: 'Dohertys_Tower_DSM', name: 'Dohertys_Tower_DSM', cog: 'https://data.better-open-data.com/lidar_zstd/Dohertys_Tower_DSM.tif', tileSize: 256, maxzoom: 16 },
      { id: 'Dohertys_Tower_DTM', name: 'Dohertys_Tower_DTM', cog: 'https://data.better-open-data.com/lidar_zstd/Dohertys_Tower_DTM.tif', tileSize: 256, maxzoom: 16 },
      { id: 'Donegore_DSM', name: 'Donegore_DSM', cog: 'https://data.better-open-data.com/lidar_zstd/Donegore_DSM.tif', tileSize: 256, maxzoom: 16 },
      { id: 'Donegore_DTM', name: 'Donegore_DTM', cog: 'https://data.better-open-data.com/lidar_zstd/Donegore_DTM.tif', tileSize: 256, maxzoom: 16 },
      { id: 'Dougary_02_02_2012_DSM', name: 'Dougary_02_02_2012_DSM', cog: 'https://data.better-open-data.com/lidar_zstd/Dougary_02_02_2012_DSM.tif', tileSize: 256, maxzoom: 16 },
      { id: 'Dougary_02_02_2012_DTM', name: 'Dougary_02_02_2012_DTM', cog: 'https://data.better-open-data.com/lidar_zstd/Dougary_02_02_2012_DTM.tif', tileSize: 256, maxzoom: 16 },
      { id: 'Downpatrick_05_05_2009_DSM', name: 'Downpatrick_05_05_2009_DSM', cog: 'https://data.better-open-data.com/lidar_zstd/Downpatrick_05_05_2009_DSM.tif', tileSize: 256, maxzoom: 16 },
      { id: 'Downpatrick_05_05_2009_DTM', name: 'Downpatrick_05_05_2009_DTM', cog: 'https://data.better-open-data.com/lidar_zstd/Downpatrick_05_05_2009_DTM.tif', tileSize: 256, maxzoom: 16 },
      { id: 'Dundrum_DSM', name: 'Dundrum_DSM', cog: 'https://data.better-open-data.com/lidar_zstd/Dundrum_DSM.tif', tileSize: 256, maxzoom: 16 },
      { id: 'Dundrum_DTM', name: 'Dundrum_DTM', cog: 'https://data.better-open-data.com/lidar_zstd/Dundrum_DTM.tif', tileSize: 256, maxzoom: 16 },
      { id: 'Dunluce_DSM', name: 'Dunluce_DSM', cog: 'https://data.better-open-data.com/lidar_zstd/Dunluce_DSM.tif', tileSize: 256, maxzoom: 16 },
      { id: 'Dunluce_DTM', name: 'Dunluce_DTM', cog: 'https://data.better-open-data.com/lidar_zstd/Dunluce_DTM.tif', tileSize: 256, maxzoom: 16 },
      { id: 'Dunmull_DSM', name: 'Dunmull_DSM', cog: 'https://data.better-open-data.com/lidar_zstd/Dunmull_DSM.tif', tileSize: 256, maxzoom: 16 },
      { id: 'Dunmull_DTM', name: 'Dunmull_DTM', cog: 'https://data.better-open-data.com/lidar_zstd/Dunmull_DTM.tif', tileSize: 256, maxzoom: 16 },
      { id: 'Dunmurry_04_04_2007_DTM', name: 'Dunmurry_04_04_2007_DTM', cog: 'https://data.better-open-data.com/lidar_zstd/Dunmurry_04_04_2007_DTM.tif', tileSize: 256, maxzoom: 16 },
      { id: 'Dunseverick_DSM', name: 'Dunseverick_DSM', cog: 'https://data.better-open-data.com/lidar_zstd/Dunseverick_DSM.tif', tileSize: 256, maxzoom: 16 },
      { id: 'Dunseverick_DTM', name: 'Dunseverick_DTM', cog: 'https://data.better-open-data.com/lidar_zstd/Dunseverick_DTM.tif', tileSize: 256, maxzoom: 16 },
      { id: 'East Belfast_29_05_2013_DSM', name: 'East Belfast_29_05_2013_DSM', cog: 'https://data.better-open-data.com/lidar_zstd/East Belfast_29_05_2013_DSM.tif', tileSize: 256, maxzoom: 16 },
      { id: 'East Belfast_29_05_2013_DTM', name: 'East Belfast_29_05_2013_DTM', cog: 'https://data.better-open-data.com/lidar_zstd/East Belfast_29_05_2013_DTM.tif', tileSize: 256, maxzoom: 16 },
      { id: 'Eglinton_11_12_2012_DSM', name: 'Eglinton_11_12_2012_DSM', cog: 'https://data.better-open-data.com/lidar_zstd/Eglinton_11_12_2012_DSM.tif', tileSize: 256, maxzoom: 16 },
      { id: 'Eglinton_11_12_2012_DTM', name: 'Eglinton_11_12_2012_DTM', cog: 'https://data.better-open-data.com/lidar_zstd/Eglinton_11_12_2012_DTM.tif', tileSize: 256, maxzoom: 16 },
      { id: 'Enniskillen_05_03_2012_DSM', name: 'Enniskillen_05_03_2012_DSM', cog: 'https://data.better-open-data.com/lidar_zstd/Enniskillen_05_03_2012_DSM.tif', tileSize: 256, maxzoom: 16 },
      { id: 'Enniskillen_05_03_2012_DTM', name: 'Enniskillen_05_03_2012_DTM', cog: 'https://data.better-open-data.com/lidar_zstd/Enniskillen_05_03_2012_DTM.tif', tileSize: 256, maxzoom: 16 },
      { id: 'Fintona_02_02_2012_DSM', name: 'Fintona_02_02_2012_DSM', cog: 'https://data.better-open-data.com/lidar_zstd/Fintona_02_02_2012_DSM.tif', tileSize: 256, maxzoom: 16 },
      { id: 'Fintona_02_02_2012_DTM', name: 'Fintona_02_02_2012_DTM', cog: 'https://data.better-open-data.com/lidar_zstd/Fintona_02_02_2012_DTM.tif', tileSize: 256, maxzoom: 16 },
      { id: 'Folk Park Newtownstewart_02_02_2012_DSM', name: 'Folk Park Newtownstewart_02_02_2012_DSM', cog: 'https://data.better-open-data.com/lidar_zstd/Folk Park Newtownstewart_02_02_2012_DSM.tif', tileSize: 256, maxzoom: 16 },
      { id: 'Folk Park Newtownstewart_02_02_2012_DTM', name: 'Folk Park Newtownstewart_02_02_2012_DTM', cog: 'https://data.better-open-data.com/lidar_zstd/Folk Park Newtownstewart_02_02_2012_DTM.tif', tileSize: 256, maxzoom: 16 },
      { id: 'Foyle_23_05_2004_DSM', name: 'Foyle_23_05_2004_DSM', cog: 'https://data.better-open-data.com/lidar_zstd/Foyle_23_05_2004_DSM.tif', tileSize: 256, maxzoom: 16 },
      { id: 'Foyle_23_05_2004_DTM', name: 'Foyle_23_05_2004_DTM', cog: 'https://data.better-open-data.com/lidar_zstd/Foyle_23_05_2004_DTM.tif', tileSize: 256, maxzoom: 16 },
      { id: 'Garron_DSM', name: 'Garron_DSM', cog: 'https://data.better-open-data.com/lidar_zstd/Garron_DSM.tif', tileSize: 256, maxzoom: 16 },
      { id: 'Garron_DTM', name: 'Garron_DTM', cog: 'https://data.better-open-data.com/lidar_zstd/Garron_DTM.tif', tileSize: 256, maxzoom: 16 },
      { id: 'Giants_Sconce_DSM', name: 'Giants_Sconce_DSM', cog: 'https://data.better-open-data.com/lidar_zstd/Giants_Sconce_DSM.tif', tileSize: 256, maxzoom: 16 },
      { id: 'Giants_Sconce_DTM', name: 'Giants_Sconce_DTM', cog: 'https://data.better-open-data.com/lidar_zstd/Giants_Sconce_DTM.tif', tileSize: 256, maxzoom: 16 },
      { id: 'Glenavy_02_02_2012_DSM', name: 'Glenavy_02_02_2012_DSM', cog: 'https://data.better-open-data.com/lidar_zstd/Glenavy_02_02_2012_DSM.tif', tileSize: 256, maxzoom: 16 },
      { id: 'Glenavy_02_02_2012_DTM', name: 'Glenavy_02_02_2012_DTM', cog: 'https://data.better-open-data.com/lidar_zstd/Glenavy_02_02_2012_DTM.tif', tileSize: 256, maxzoom: 16 },
      { id: 'Glynn_DSM', name: 'Glynn_DSM', cog: 'https://data.better-open-data.com/lidar_zstd/Glynn_DSM.tif', tileSize: 256, maxzoom: 16 },
      { id: 'Glynn_DTM', name: 'Glynn_DTM', cog: 'https://data.better-open-data.com/lidar_zstd/Glynn_DTM.tif', tileSize: 256, maxzoom: 16 },
      { id: 'Greyabbey_Ballywalter_DSM', name: 'Greyabbey_Ballywalter_DSM', cog: 'https://data.better-open-data.com/lidar_zstd/Greyabbey_Ballywalter_DSM.tif', tileSize: 256, maxzoom: 16 },
      { id: 'Greyabbey_Ballywalter_DTM', name: 'Greyabbey_Ballywalter_DTM', cog: 'https://data.better-open-data.com/lidar_zstd/Greyabbey_Ballywalter_DTM.tif', tileSize: 256, maxzoom: 16 },
      { id: 'Inch_Abbey_DSM', name: 'Inch_Abbey_DSM', cog: 'https://data.better-open-data.com/lidar_zstd/Inch_Abbey_DSM.tif', tileSize: 256, maxzoom: 16 },
      { id: 'Inch_Abbey_DTM', name: 'Inch_Abbey_DTM', cog: 'https://data.better-open-data.com/lidar_zstd/Inch_Abbey_DTM.tif', tileSize: 256, maxzoom: 16 },
      { id: 'Keady_02_02_2012_DSM', name: 'Keady_02_02_2012_DSM', cog: 'https://data.better-open-data.com/lidar_zstd/Keady_02_02_2012_DSM.tif', tileSize: 256, maxzoom: 16 },
      { id: 'Keady_02_02_2012_DTM', name: 'Keady_02_02_2012_DTM', cog: 'https://data.better-open-data.com/lidar_zstd/Keady_02_02_2012_DTM.tif', tileSize: 256, maxzoom: 16 },
      { id: 'Killyleagh__15_03_2010_DTM', name: 'Killyleagh__15_03_2010_DTM', cog: 'https://data.better-open-data.com/lidar_zstd/Killyleagh__15_03_2010_DTM.tif', tileSize: 256, maxzoom: 16 },
      { id: 'Kiltierney_DSM', name: 'Kiltierney_DSM', cog: 'https://data.better-open-data.com/lidar_zstd/Kiltierney_DSM.tif', tileSize: 256, maxzoom: 16 },
      { id: 'Kiltierney_DTM', name: 'Kiltierney_DTM', cog: 'https://data.better-open-data.com/lidar_zstd/Kiltierney_DTM.tif', tileSize: 256, maxzoom: 16 },
      { id: 'Larne_15_03_2010_DTM', name: 'Larne_15_03_2010_DTM', cog: 'https://data.better-open-data.com/lidar_zstd/Larne_15_03_2010_DTM.tif', tileSize: 256, maxzoom: 16 },
      { id: 'Limavady_23_05_2004_DSM', name: 'Limavady_23_05_2004_DSM', cog: 'https://data.better-open-data.com/lidar_zstd/Limavady_23_05_2004_DSM.tif', tileSize: 256, maxzoom: 16 },
      { id: 'Limavady_23_05_2004_DTM', name: 'Limavady_23_05_2004_DTM', cog: 'https://data.better-open-data.com/lidar_zstd/Limavady_23_05_2004_DTM.tif', tileSize: 256, maxzoom: 16 },
      { id: 'Linford_DSM', name: 'Linford_DSM', cog: 'https://data.better-open-data.com/lidar_zstd/Linford_DSM.tif', tileSize: 256, maxzoom: 16 },
      { id: 'Linford_DTM', name: 'Linford_DTM', cog: 'https://data.better-open-data.com/lidar_zstd/Linford_DTM.tif', tileSize: 256, maxzoom: 16 },
      { id: 'Lisbellaw_05_03_2012_DSM', name: 'Lisbellaw_05_03_2012_DSM', cog: 'https://data.better-open-data.com/lidar_zstd/Lisbellaw_05_03_2012_DSM.tif', tileSize: 256, maxzoom: 16 },
      { id: 'Lisbellaw_05_03_2012_DTM', name: 'Lisbellaw_05_03_2012_DTM', cog: 'https://data.better-open-data.com/lidar_zstd/Lisbellaw_05_03_2012_DTM.tif', tileSize: 256, maxzoom: 16 },
      { id: 'Lisburn_15_03_2010_DTM', name: 'Lisburn_15_03_2010_DTM', cog: 'https://data.better-open-data.com/lidar_zstd/Lisburn_15_03_2010_DTM.tif', tileSize: 256, maxzoom: 16 },
      { id: 'Londonderry_30_04_2009_DTM', name: 'Londonderry_30_04_2009_DTM', cog: 'https://data.better-open-data.com/lidar_zstd/Londonderry_30_04_2009_DTM.tif', tileSize: 256, maxzoom: 16 },
      { id: 'LoughNeagh_2017_DSM', name: 'LoughNeagh_2017_DSM', cog: 'https://data.better-open-data.com/lidar_zstd/LoughNeagh_2017_DSM.tif', tileSize: 256, maxzoom: 16 },
      { id: 'LoughNeagh_2017_DTM', name: 'LoughNeagh_2017_DTM', cog: 'https://data.better-open-data.com/lidar_zstd/LoughNeagh_2017_DTM.tif', tileSize: 256, maxzoom: 16 },
      { id: 'LowerBann_16_06_2014_DSM', name: 'LowerBann_16_06_2014_DSM', cog: 'https://data.better-open-data.com/lidar_zstd/LowerBann_16_06_2014_DSM.tif', tileSize: 256, maxzoom: 16 },
      { id: 'LowerBann_16_06_2014_DTM', name: 'LowerBann_16_06_2014_DTM', cog: 'https://data.better-open-data.com/lidar_zstd/LowerBann_16_06_2014_DTM.tif', tileSize: 256, maxzoom: 16 },
      { id: 'Lurgan_05_03_2012_DSM', name: 'Lurgan_05_03_2012_DSM', cog: 'https://data.better-open-data.com/lidar_zstd/Lurgan_05_03_2012_DSM.tif', tileSize: 256, maxzoom: 16 },
      { id: 'Lurgan_05_03_2012_DTM', name: 'Lurgan_05_03_2012_DTM', cog: 'https://data.better-open-data.com/lidar_zstd/Lurgan_05_03_2012_DTM.tif', tileSize: 256, maxzoom: 16 },
      { id: 'Lyles_Hill_DSM', name: 'Lyles_Hill_DSM', cog: 'https://data.better-open-data.com/lidar_zstd/Lyles_Hill_DSM.tif', tileSize: 256, maxzoom: 16 },
      { id: 'Lyles_Hill_DTM', name: 'Lyles_Hill_DTM', cog: 'https://data.better-open-data.com/lidar_zstd/Lyles_Hill_DTM.tif', tileSize: 256, maxzoom: 16 },
      { id: 'Maghera_20_04_2009_DSM', name: 'Maghera_20_04_2009_DSM', cog: 'https://data.better-open-data.com/lidar_zstd/Maghera_20_04_2009_DSM.tif', tileSize: 256, maxzoom: 16 },
      { id: 'Maghera_20_04_2009_DTM', name: 'Maghera_20_04_2009_DTM', cog: 'https://data.better-open-data.com/lidar_zstd/Maghera_20_04_2009_DTM.tif', tileSize: 256, maxzoom: 16 },
      { id: 'Magherafelt_15_03_2010_DTM', name: 'Magherafelt_15_03_2010_DTM', cog: 'https://data.better-open-data.com/lidar_zstd/Magherafelt_15_03_2010_DTM.tif', tileSize: 256, maxzoom: 16 },
      { id: 'Magheramore_DSM', name: 'Magheramore_DSM', cog: 'https://data.better-open-data.com/lidar_zstd/Magheramore_DSM.tif', tileSize: 256, maxzoom: 16 },
      { id: 'Magheramore_DTM', name: 'Magheramore_DTM', cog: 'https://data.better-open-data.com/lidar_zstd/Magheramore_DTM.tif', tileSize: 256, maxzoom: 16 },
      { id: 'Maguiresbridge_05_03_2012_DSM', name: 'Maguiresbridge_05_03_2012_DSM', cog: 'https://data.better-open-data.com/lidar_zstd/Maguiresbridge_05_03_2012_DSM.tif', tileSize: 256, maxzoom: 16 },
      { id: 'Maguiresbridge_05_03_2012_DTM', name: 'Maguiresbridge_05_03_2012_DTM', cog: 'https://data.better-open-data.com/lidar_zstd/Maguiresbridge_05_03_2012_DTM.tif', tileSize: 256, maxzoom: 16 },
      { id: 'Mobuoy_DSM', name: 'Mobuoy_DSM', cog: 'https://data.better-open-data.com/lidar_zstd/Mobuoy_DSM.tif', tileSize: 256, maxzoom: 16 },
      { id: 'Mobuoy_DTM', name: 'Mobuoy_DTM', cog: 'https://data.better-open-data.com/lidar_zstd/Mobuoy_DTM.tif', tileSize: 256, maxzoom: 16 },
      { id: 'Moneymore_05_03_2012_DSM', name: 'Moneymore_05_03_2012_DSM', cog: 'https://data.better-open-data.com/lidar_zstd/Moneymore_05_03_2012_DSM.tif', tileSize: 256, maxzoom: 16 },
      { id: 'Moneymore_05_03_2012_DTM', name: 'Moneymore_05_03_2012_DTM', cog: 'https://data.better-open-data.com/lidar_zstd/Moneymore_05_03_2012_DTM.tif', tileSize: 256, maxzoom: 16 },
      { id: 'Mossley_05_03_2012_DSM', name: 'Mossley_05_03_2012_DSM', cog: 'https://data.better-open-data.com/lidar_zstd/Mossley_05_03_2012_DSM.tif', tileSize: 256, maxzoom: 16 },
      { id: 'Mossley_05_03_2012_DTM', name: 'Mossley_05_03_2012_DTM', cog: 'https://data.better-open-data.com/lidar_zstd/Mossley_05_03_2012_DTM.tif', tileSize: 256, maxzoom: 16 },
      { id: 'Mount_Stewart_DSM', name: 'Mount_Stewart_DSM', cog: 'https://data.better-open-data.com/lidar_zstd/Mount_Stewart_DSM.tif', tileSize: 256, maxzoom: 16 },
      { id: 'Mount_Stewart_DTM', name: 'Mount_Stewart_DTM', cog: 'https://data.better-open-data.com/lidar_zstd/Mount_Stewart_DTM.tif', tileSize: 256, maxzoom: 16 },
      { id: 'Navan_DSM', name: 'Navan_DSM', cog: 'https://data.better-open-data.com/lidar_zstd/Navan_DSM.tif', tileSize: 256, maxzoom: 16 },
      { id: 'Navan_DTM', name: 'Navan_DTM', cog: 'https://data.better-open-data.com/lidar_zstd/Navan_DTM.tif', tileSize: 256, maxzoom: 16 },
      { id: 'Newcastle_15_03_2010_DTM', name: 'Newcastle_15_03_2010_DTM', cog: 'https://data.better-open-data.com/lidar_zstd/Newcastle_15_03_2010_DTM.tif', tileSize: 256, maxzoom: 16 },
      { id: 'Newry_15_03_2010_DTM', name: 'Newry_15_03_2010_DTM', cog: 'https://data.better-open-data.com/lidar_zstd/Newry_15_03_2010_DTM.tif', tileSize: 256, maxzoom: 16 },
      { id: 'Newtownabbey_15_03_2010_DTM', name: 'Newtownabbey_15_03_2010_DTM', cog: 'https://data.better-open-data.com/lidar_zstd/Newtownabbey_15_03_2010_DTM.tif', tileSize: 256, maxzoom: 16 },
      { id: 'Newtownards_10_06_2008_DSM', name: 'Newtownards_10_06_2008_DSM', cog: 'https://data.better-open-data.com/lidar_zstd/Newtownards_10_06_2008_DSM.tif', tileSize: 256, maxzoom: 16 },
      { id: 'Newtownards_10_06_2008_DTM', name: 'Newtownards_10_06_2008_DTM', cog: 'https://data.better-open-data.com/lidar_zstd/Newtownards_10_06_2008_DTM.tif', tileSize: 256, maxzoom: 16 },
      { id: 'Newtownstewart_23_05_2004_DSM', name: 'Newtownstewart_23_05_2004_DSM', cog: 'https://data.better-open-data.com/lidar_zstd/Newtownstewart_23_05_2004_DSM.tif', tileSize: 256, maxzoom: 16 },
      { id: 'Newtownstewart_23_05_2004_DTM', name: 'Newtownstewart_23_05_2004_DTM', cog: 'https://data.better-open-data.com/lidar_zstd/Newtownstewart_23_05_2004_DTM.tif', tileSize: 256, maxzoom: 16 },
      { id: 'Omagh_23_05_2004_DSM', name: 'Omagh_23_05_2004_DSM', cog: 'https://data.better-open-data.com/lidar_zstd/Omagh_23_05_2004_DSM.tif', tileSize: 256, maxzoom: 16 },
      { id: 'Omagh_23_05_2004_DTM', name: 'Omagh_23_05_2004_DTM', cog: 'https://data.better-open-data.com/lidar_zstd/Omagh_23_05_2004_DTM.tif', tileSize: 256, maxzoom: 16 },
      { id: 'Omagh_Town_11_12_2012_DSM', name: 'Omagh_Town_11_12_2012_DSM', cog: 'https://data.better-open-data.com/lidar_zstd/Omagh_Town_11_12_2012_DSM.tif', tileSize: 256, maxzoom: 16 },
      { id: 'Omagh_Town_11_12_2012_DTM', name: 'Omagh_Town_11_12_2012_DTM', cog: 'https://data.better-open-data.com/lidar_zstd/Omagh_Town_11_12_2012_DTM.tif', tileSize: 256, maxzoom: 16 },
      { id: 'Portadown_27_04_2009_DSM', name: 'Portadown_27_04_2009_DSM', cog: 'https://data.better-open-data.com/lidar_zstd/Portadown_27_04_2009_DSM.tif', tileSize: 256, maxzoom: 16 },
      { id: 'Portadown_27_04_2009_DTM', name: 'Portadown_27_04_2009_DTM', cog: 'https://data.better-open-data.com/lidar_zstd/Portadown_27_04_2009_DTM.tif', tileSize: 256, maxzoom: 16 },
      { id: 'PortadownExtension_02_02_2012_DSM', name: 'PortadownExtension_02_02_2012_DSM', cog: 'https://data.better-open-data.com/lidar_zstd/PortadownExtension_02_02_2012_DSM.tif', tileSize: 256, maxzoom: 16 },
      { id: 'PortadownExtension_02_02_2012_DTM', name: 'PortadownExtension_02_02_2012_DTM', cog: 'https://data.better-open-data.com/lidar_zstd/PortadownExtension_02_02_2012_DTM.tif', tileSize: 256, maxzoom: 16 },
      { id: 'Raholp_DSM', name: 'Raholp_DSM', cog: 'https://data.better-open-data.com/lidar_zstd/Raholp_DSM.tif', tileSize: 256, maxzoom: 16 },
      { id: 'Raholp_DTM', name: 'Raholp_DTM', cog: 'https://data.better-open-data.com/lidar_zstd/Raholp_DTM.tif', tileSize: 256, maxzoom: 16 },
      { id: 'Randalstown_15_03_2010_DTM', name: 'Randalstown_15_03_2010_DTM', cog: 'https://data.better-open-data.com/lidar_zstd/Randalstown_15_03_2010_DTM.tif', tileSize: 256, maxzoom: 16 },
      { id: 'Redbay3m', name: 'Redbay3m', cog: 'https://data.better-open-data.com/lidar_zstd/Redbay3m.tif', tileSize: 256, maxzoom: 16 },
      { id: 'Ringreagh_DSM', name: 'Ringreagh_DSM', cog: 'https://data.better-open-data.com/lidar_zstd/Ringreagh_DSM.tif', tileSize: 256, maxzoom: 16 },
      { id: 'Ringreagh_DTM', name: 'Ringreagh_DTM', cog: 'https://data.better-open-data.com/lidar_zstd/Ringreagh_DTM.tif', tileSize: 256, maxzoom: 16 },
      { id: 'Saintfield_02_02_2012_DSM', name: 'Saintfield_02_02_2012_DSM', cog: 'https://data.better-open-data.com/lidar_zstd/Saintfield_02_02_2012_DSM.tif', tileSize: 256, maxzoom: 16 },
      { id: 'Saintfield_02_02_2012_DTM', name: 'Saintfield_02_02_2012_DTM', cog: 'https://data.better-open-data.com/lidar_zstd/Saintfield_02_02_2012_DTM.tif', tileSize: 256, maxzoom: 16 },
      { id: 'Saul_DSM', name: 'Saul_DSM', cog: 'https://data.better-open-data.com/lidar_zstd/Saul_DSM.tif', tileSize: 256, maxzoom: 16 },
      { id: 'Saul_DTM', name: 'Saul_DTM', cog: 'https://data.better-open-data.com/lidar_zstd/Saul_DTM.tif', tileSize: 256, maxzoom: 16 },
      { id: 'Scrabo_DSM', name: 'Scrabo_DSM', cog: 'https://data.better-open-data.com/lidar_zstd/Scrabo_DSM.tif', tileSize: 256, maxzoom: 16 },
      { id: 'Scrabo_DTM', name: 'Scrabo_DTM', cog: 'https://data.better-open-data.com/lidar_zstd/Scrabo_DTM.tif', tileSize: 256, maxzoom: 16 },
      { id: 'Sion_Mills_02_02_2012_DSM', name: 'Sion_Mills_02_02_2012_DSM', cog: 'https://data.better-open-data.com/lidar_zstd/Sion_Mills_02_02_2012_DSM.tif', tileSize: 256, maxzoom: 16 },
      { id: 'Sion_Mills_02_02_2012_DTM', name: 'Sion_Mills_02_02_2012_DTM', cog: 'https://data.better-open-data.com/lidar_zstd/Sion_Mills_02_02_2012_DTM.tif', tileSize: 256, maxzoom: 16 },
      { id: 'Slemish_DSM', name: 'Slemish_DSM', cog: 'https://data.better-open-data.com/lidar_zstd/Slemish_DSM.tif', tileSize: 256, maxzoom: 16 },
      { id: 'Slemish_DTM', name: 'Slemish_DTM', cog: 'https://data.better-open-data.com/lidar_zstd/Slemish_DTM.tif', tileSize: 256, maxzoom: 16 },
      { id: 'Stonyford_16_06_2014_DSM', name: 'Stonyford_16_06_2014_DSM', cog: 'https://data.better-open-data.com/lidar_zstd/Stonyford_16_06_2014_DSM.tif', tileSize: 256, maxzoom: 16 },
      { id: 'Stonyford_16_06_2014_DTM', name: 'Stonyford_16_06_2014_DTM', cog: 'https://data.better-open-data.com/lidar_zstd/Stonyford_16_06_2014_DTM.tif', tileSize: 256, maxzoom: 16 },
      { id: 'Strabane_23_05_2004_DSM', name: 'Strabane_23_05_2004_DSM', cog: 'https://data.better-open-data.com/lidar_zstd/Strabane_23_05_2004_DSM.tif', tileSize: 256, maxzoom: 16 },
      { id: 'Strabane_23_05_2004_DTM', name: 'Strabane_23_05_2004_DTM', cog: 'https://data.better-open-data.com/lidar_zstd/Strabane_23_05_2004_DTM.tif', tileSize: 256, maxzoom: 16 },
      { id: 'Strangford2m', name: 'Strangford2m', cog: 'https://data.better-open-data.com/lidar_zstd/Strangford2m.tif', tileSize: 256, maxzoom: 16 },
      { id: 'Struell_DSM', name: 'Struell_DSM', cog: 'https://data.better-open-data.com/lidar_zstd/Struell_DSM.tif', tileSize: 256, maxzoom: 16 },
      { id: 'Struell_DTM', name: 'Struell_DTM', cog: 'https://data.better-open-data.com/lidar_zstd/Struell_DTM.tif', tileSize: 256, maxzoom: 16 },
      { id: 'Tandragee_15_03_2010_DTM', name: 'Tandragee_15_03_2010_DTM', cog: 'https://data.better-open-data.com/lidar_zstd/Tandragee_15_03_2010_DTM.tif', tileSize: 256, maxzoom: 16 },
      { id: 'The_Dorsey_DSM', name: 'The_Dorsey_DSM', cog: 'https://data.better-open-data.com/lidar_zstd/The_Dorsey_DSM.tif', tileSize: 256, maxzoom: 16 },
      { id: 'The_Dorsey_DTM', name: 'The_Dorsey_DTM', cog: 'https://data.better-open-data.com/lidar_zstd/The_Dorsey_DTM.tif', tileSize: 256, maxzoom: 16 },
      { id: 'Tirgoland_DSM', name: 'Tirgoland_DSM', cog: 'https://data.better-open-data.com/lidar_zstd/Tirgoland_DSM.tif', tileSize: 256, maxzoom: 16 },
      { id: 'Tirgoland_DTM', name: 'Tirgoland_DTM', cog: 'https://data.better-open-data.com/lidar_zstd/Tirgoland_DTM.tif', tileSize: 256, maxzoom: 16 },
      { id: 'Tullaghoge_DSM', name: 'Tullaghoge_DSM', cog: 'https://data.better-open-data.com/lidar_zstd/Tullaghoge_DSM.tif', tileSize: 256, maxzoom: 16 },
      { id: 'Tullaghoge_DTM', name: 'Tullaghoge_DTM', cog: 'https://data.better-open-data.com/lidar_zstd/Tullaghoge_DTM.tif', tileSize: 256, maxzoom: 16 },

    ],
    defaultModel: '10m',       // selected initially; defaults to the first model
    exaggeration: 1.0,         // vertical exaggeration in the 3D view
    pitch: 60,                 // tilt when 3D is switched on (0-80)
    tileSize: 256,             // the COG's internal tile size (256 or 512)
    hillshade: true,           // add a "Hillshade (DTM)" layer to the legend (id 'hillshade', usable in themes)
    hillshadeVisible: true,    // start with the hillshade switched on?
    hillshadeStrength: 0.6,    // 0-1, shading strength at 0% transparency
    hillshadeStyle: {
      method: 'standard', direction: 315, altitude: 45, anchor: 'map',
      shadowColor: '#000000', highlightColor: '#ffffff', accentColor: '#000000'
    },
    contours: {
      visible: false,
      opacity: 0.5,
      colors: { minor: '#808384', major: '#30383b' },
      thresholds: {
        11: [100, 500],
        12: [50, 500], 
        13: [10, 100], 
        14: [10, 100], 
        15: [10, 100], 
        16: [10, 100]
      }
    },
    allThemes: true            // hillshade + 3D tick boxes stay available in every theme (false = hillshade follows themes' `overlays`)
    // optional: hillshadeName, group, info (link or { metadata }), attribution
  },

///////////////////////////////////////////////////////////////////////////
//  Initial View and Zoom
///////////////////////////////////////////////////////////////////////////

  center: [-6.5, 54.6],       // [lon, lat]
  zoom: 8
};
