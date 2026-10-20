export default {
    id: 'test-deployment',
    title: 'Test Deployment',
    deploymentId: 'test-deployment',
    dataDirectory: 'data/test-deployment/',
    brandColor: '#287271',
    linkField: 'SITE_ID',
    geometryField: 'GEOM',
    projection: 'EPSG:4326',
    labelField: 'SITE_NAME',
    popupFields: [
        { field: 'SITE_NAME', bold: true },
        { field: 'SITE_ID' },
        { field: 'CATEGORY' },
        { field: 'STATUS' },
        { field: 'SITE_SCORE', label: 'Site Score' },
        { type: 'zoomLink', label: 'Zoom to site' }
    ],
    legendTitle: 'Site score',
    filterGroupTitle: 'Test Deployment Filters/Results',
    clustering: false,
    truncateCells: true,
    tabs: [
        {
            key: 'sites', label: 'Sites', file: 'sites.json',
            dataKey: 'test_sites', isPrimary: true, exportRows: 'filtered'
        },
        {
            key: 'observations', label: 'Observations', file: 'observations.json',
            dataKey: 'test_observations', icon: 'fa-vials', specialFilter: 'Observations', exportRows: 'filtered', hideable: true
        },
        {
            key: 'samples', label: 'Samples', file: 'samples.json',
            dataKey: 'test_samples', icon: 'fa-cubes', exportRows: 'filtered', hideable: true
        }
    ],
    dropdownColumns: ['CATEGORY', 'STATUS', 'PARAMETER', 'UNIT', 'SAMPLE_TYPE', 'LAB_STATUS'],
    rangeFilterColumns: {
        SITE_SCORE: 'gte',
        VALUE: 'gte'
    },
    hiddenColumns: ['SITE_ID', 'GEOM'],
    nonNumericColumns: ['SAMPLE_ID'],
    urlFields: {},
    computedLinks: [],
    depthField: 'SITE_SCORE',
    depthClasses: [
        { max: 65, fill: '#d73027', label: 'Low (0-65)' },
        { max: 85, fill: '#fee08b', label: 'Medium (66-85)' },
        { max: Infinity, fill: '#1a9850', label: 'High (86-100)' }
    ]
};