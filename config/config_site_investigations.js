export default {
    id: 'site-investigations',
    title: 'Site Investigations',
    deploymentId: 'site-investigations',
    dataDirectory: 'data/site-investigations/',
    brandColor: '#287271',
    // Geometry comes from this CONFIG.datasets entry and vector layer, joined on geometryLinkField (no GEOM column in the JSON).
    geometryDataset: 'bores',
    geometryLayer: 'Boreholes',
    geometryLinkField: 'OBJECTID',
    linkField: 'OBJECTID',
    labelField: 'BNAME',
    popupFields: [
        { field: 'BNAME', bold: true },
        { field: 'PURPOSE' },
        { field: 'CLIENT' },
        { field: 'TOTDEPTH', label: 'Total depth', suffix: 'm' },
        { type: 'zoomLink', label: 'Zoom to borehole' }
    ],
    legendTitle: 'Total depth',
    filterGroupTitle: 'Site Investigation Filters/Results',
    clustering: false,
    truncateCells: true,
    tabs: [
        {
            key: 'boreholes', label: 'Boreholes', file: 'boreholes.json',
            dataKey: 'si_boreholes', isPrimary: true, exportRows: 'filtered'
        },
        {
            key: 'strata', label: 'Strata', file: 'strata.json',
            dataKey: 'si_strata', icon: 'fa-layer-group', exportRows: 'filtered', hideable: true
        },
        {
            key: 'samples', label: 'Samples', file: 'samples.json',
            dataKey: 'si_samples', icon: 'fa-cubes', specialFilter: 'Samples', exportRows: 'filtered', hideable: true
        }
    ],
    dropdownColumns: ['PURPOSE', 'CLIENT', 'LITHOLOGY', 'SAMPLE_TYPE', 'LAB_STATUS'],
    rangeFilterColumns: {
        TOTDEPTH: 'gte'
    },
    hiddenColumns: ['OBJECTID'],
    nonNumericColumns: ['SAMPLE_ID'],
    urlFields: {},
    computedLinks: [],
    depthField: 'TOTDEPTH',
    depthClasses: [
        { max: 5, fill: '#d73027', label: 'Shallow (0-5 m)' },
        { max: 20, fill: '#fee08b', label: 'Medium (5-20 m)' },
        { max: Infinity, fill: '#1a9850', label: 'Deep (> 20 m)' }
    ]
};
