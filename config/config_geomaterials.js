export default {
    id: 'geomaterials',
    title: 'Geomaterials',
    deploymentId: 'geomaterials',
    dataDirectory: 'data/geomaterials/',
    deploymentsFile: 'config/deployments.json',
    deploymentLinksFile: 'config/deploymentlinks.json',
    urlBases: {
        sampleTrayImages: 'http://127.0.0.1:8080/geomaterials/sampletrays/'
    },
    brandColor: '#2c3e50',
    linkField: 'BOREHOLE ID',
    geometryField: 'GEOM',
    projection: 'EPSG:29902',
    labelField: 'BOREHOLE NAME',
    popupFields: [
        { field: 'BOREHOLE NAME', bold: true },
        { field: 'BOREHOLE ID' },
        { field: 'COMPANY NAME' },
        { field: 'TOTAL DEPTH METRES', label: 'Total Depth', suffix: ' M' },
        { field: 'BOREHOLE_LOG_URL' },
        { type: 'zoomLink', label: 'Zoom to site' }
    ],
    mapCenter: [54.62, -6.39],
    mapZoom: 8,
    legendTitle: 'Borehole depth',
    filterGroupTitle: 'Quick Filters/Results Table',
    clustering: false,
    truncateCells: true,
    tabs: [
        {
            key: 'boreholes', label: 'Boreholes', file: 'api_v2_boreholes.json',
            dataKey: 'api_v2_boreholes', isPrimary: true, icon: 'fa-map-pin',
            exportRows: 'filtered',
            help: {
                title: 'Borehole Locations',
                content: `<p>Each row is a borehole logged by the survey.</p>
                    <ul>
                        <li>Depth values are in metres below ground level</li>
                        <li>Use the >= filter on Depth to find deep boreholes</li>
                    </ul>
                    <p>View the <a target="blank" href="https://gsni-data.bgs.ac.uk/geonetwork/srv/eng/catalog.search#/metadata/09757268-929d-4203-b1fc-56d9391e4688">metadata on the Data Catalogue</a></p>`
            }
        },
        {
            key: 'geology', label: 'Geology', file: 'api_v2_downhole.json',
            dataKey: 'api_v2_downhole', icon: 'fa-layer-group', specialFilter: 'Geology',
            exportRows: 'all', hideable: true,
            help: {
                title: 'Downhole Geology',
                content: `<p>Coded to provide a broad overview of the geology, linked to the BGS Lexicon.</p>
                    <ul>
                        <li>Depth values are in metres below ground level</li>
                        <li>Use the >= filter on Depth to find deep boreholes</li>
                        <li>Click on the >= to toggle</li>
                    </ul>`
            }
        },
        {
            key: 'coreboxes', label: 'Core Boxes', file: 'api_v2_core_boxes.json',
            dataKey: 'api_v2_core_boxes', icon: 'fa-box', specialFilter: 'Core Boxes',
            exportRows: 'filtered', hideable: true,
            help: {
                title: 'Core Boxes',
                content: '<p>Boreholes for which there are coreboxes retained in the GSNI Core Store. These may be continuous cores or cores for selected intervals.</p>'
            }
        },
        {
            key: 'sampletrays', label: 'Sample Trays', file: 'api_v2_borehole_sample_trays.json',
            dataKey: 'api_v2_borehole_sample_trays', icon: 'fa-cubes',
            specialFilter: 'Sample Trays', exportRows: 'filtered', hideable: true,
            help: {
                title: 'Sample Trays',
                content: '<p>Trays containing discontinuous core samples from boreholes.</p>'
            }
        },
        {
            key: 'cuttings', label: 'Cuttings', file: 'api_v2_cuttings_box_lex.json',
            dataKey: 'api_v2_cuttings_box_lex', icon: 'fa-vials', specialFilter: 'Cuttings',
            exportRows: 'filtered', hideable: true,
            help: {
                title: 'Cuttings',
                content: `<p>Cuttings from boreholes. Typically one of the following types:</p>
                    <ul>
                        <li>Washed and Dried Cuttings</li>
                        <li>Wet Cuttings</li>
                        <li>Rockwash Cuttings (These are generally a sub-sample and have been prepared by Rockwash)</li>
                    </ul>`
            }
        },
        {
            key: 'rockwash', label: 'Rockwash', file: 'api_v2_rockwash.json',
            dataKey: 'api_v2_rockwash', icon: 'fa-vials', specialFilter: 'Rockwash',
            exportRows: 'filtered', hideable: true,
            help: {
                title: 'Rockwash Data',
                content: '<p>Samples that have been processed by Rockwash. Cuttings washed, photographed and XRF analysis carried out.</p>'
            }
        },
        {
            key: 'thinsections', label: 'Thinsections', file: 'api_v2_thinsections.json',
            dataKey: 'api_v2_thinsections', icon: 'fa-vials', specialFilter: 'Thin Sections',
            exportRows: 'filtered', hideable: true,
            help: {
                title: 'Thin Sections',
                content: '<p>Boreholes for which thin section slides are held. For many of these, the original rock sample is also retained.</p>'
            }
        },
        {
            key: 'thermalconductivity', label: 'Thermal Conductivity',
            file: 'api_v2_thermal_conductivity.json', dataKey: 'api_v2_thermal_conductivity',
            icon: 'fa-vials', specialFilter: 'Thermal Conductivity',
            exportRows: 'filtered', hideable: true,
            help: {
                title: 'Thermal Conductivity',
                content: '<p>Boreholes for which Thermal Conductivity measurements have been taken.</p>'
            }
        },
        {
            key: 'fluidinclusion', label: 'Fluid Inclusion',
            file: 'api_v2_fluid_inclusion.json', dataKey: 'api_v2_fluid_inclusion',
            icon: 'fa-vials', specialFilter: 'Fluid Inclusion',
            exportRows: 'filtered', hideable: true,
            help: {
                title: 'Fluid Inclusion Data',
                content: '<p>Samples prepared by rockwash and sent for Fluid Inclusion Analysis. Prepared samples are retained.</p>'
            }
        },
        {
            key: 'reports', label: 'Reports', file: 'api_v2_reports.json',
            dataKey: 'api_v2_reports', icon: 'fa-vials', specialFilter: 'Reports',
            exportRows: 'filtered', hideable: true,
            help: {
                title: 'Reports',
                content: '<p>Reports that contain information for the borehole.</p>'
            }
        }
    ],
    dropdownColumns: ['BOREHOLE NAME', 'COMPANY NAME', 'LEX', 'GROUP LEX', 'TOPLEX', 'BOTTOMLEX'],
    rangeFilterColumns: {
        'TOTAL DEPTH METRES': 'gte',
        TOP: 'gte',
        BOTTOM: 'lte',
        CORE_TOP_DEPTH_METRES: 'gte',
        CORE_BOTTOM_DEPTH_METRES: 'lte',
        'TOP DEPTH (M)': 'gte',
        'BOTTOM DEPTH (M)': 'lte',
        CUTTINGS_TOP_DEPTH_METRES: 'gte',
        CUTTINGS_BOTTOM_DEPTH_METRES: 'lte',
        Quartz: 'gte'
    },
    hiddenColumns: ['GEOM', 'BOREHOLE ID'],
    nonNumericColumns: [
        'COREBOXID', 'SAMPLE TRAY ID', 'CUTTINGS_BOX_ID',
        'LOCATION_CODE', 'ORIGINAL UNITS', 'THIN SECTION ID'
    ],
    urlFields: {
        BOREHOLE_LOG_URL: 'View Log'
    },
    computedLinks: [
        {
            field: 'LEX',
            prefix: 'https://webapps.bgs.ac.uk/lexicon/lexicon.cfm?pub=',
            suffix: '', icon: 'fa-external-link-alt', title: 'Search the lexicon'
        },
        {
            field: 'TOPLEX',
            prefix: 'https://webapps.bgs.ac.uk/lexicon/lexicon.cfm?pub=',
            suffix: '', icon: 'fa-external-link-alt', title: 'Search the lexicon'
        },
        {
            field: 'BOTTOMLEX',
            prefix: 'https://webapps.bgs.ac.uk/lexicon/lexicon.cfm?pub=',
            suffix: '', icon: 'fa-external-link-alt', title: 'Search the lexicon'
        },
        {
            field: 'GROUP LEX',
            prefix: 'https://webapps.bgs.ac.uk/lexicon/lexicon.cfm?pub=',
            suffix: '', icon: 'fa-external-link-alt', title: 'Search the lexicon'
        },
        {
            field: 'SAMPLE TRAY ID',
            baseKey: 'sampleTrayImages',
            suffix: '.2000.jpg', icon: 'fa-regular fa-eye', title: 'View sample tray image'
        }
    ],
    depthField: 'TOTAL DEPTH METRES',
    depthClasses: [
        { max: 0, fill: '#aaaaaa', label: 'Null / unknown' },
        { max: 50, fill: '#2166ac', label: '0 - 50 m' },
        { max: 100, fill: '#74add1', label: '50 - 100 m' },
        { max: 250, fill: '#abd9e9', label: '100 - 250 m' },
        { max: 500, fill: '#fee090', label: '250 - 500 m' },
        { max: 1000, fill: '#f46d43', label: '500 - 1,000 m' },
        { max: 1500, fill: '#d73027', label: '1,000 - 1,500 m' },
        { max: Infinity, fill: '#7b0000', label: '1,500 - 3,000 m' }
    ]
};