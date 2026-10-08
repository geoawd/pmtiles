// ════════════════════════════════════════════════════════════════════════════
// app_combined.js — Geospatial tabular data viewer
//
// Single-file variant supporting POINT, POLYGON, and MULTIPOLYGON geometry.
// Geometry type is detected automatically from the first primary record.
//
// Point deployments:   clustered markers or depth-coloured discrete markers
// Polygon deployments: categorical colour by a configured field
//
// Includes multi-select dropdown column filters (dropdownColumns in APP_CONFIG).
//
// Dependencies (must be loaded before this script):
//   - Leaflet      https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/
//   - proj4js      https://cdnjs.cloudflare.com/ajax/libs/proj4js/2.8.1/
//   - SheetJS      https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/
// ════════════════════════════════════════════════════════════════════════════

'use strict';

// ── Config validation (runs before derived constants) ────────────────────────
// Validates APP_CONFIG early so derived constants below don't throw cryptic
// errors if config is malformed.
(function earlyValidateConfig() {
    const errors = [];
    if (!APP_CONFIG.tabs?.length)
        errors.push('APP_CONFIG.tabs must be a non-empty array');
    if (!APP_CONFIG.tabs?.find(t => t.isPrimary))
        errors.push('Exactly one tab must have isPrimary: true');
    if (!APP_CONFIG.linkField)
        errors.push('APP_CONFIG.linkField is required');
    if (!APP_CONFIG.geometryField)
        errors.push('APP_CONFIG.geometryField is required');
    if (!APP_CONFIG.labelField)
        errors.push('APP_CONFIG.labelField is required');
    if (!APP_CONFIG.projection)
        errors.push('APP_CONFIG.projection is required');
    if (APP_CONFIG.mapCenter?.length !== 2)
        errors.push('APP_CONFIG.mapCenter must be [lat, lng]');
    if (!APP_CONFIG.deploymentId)
        console.warn('APP_CONFIG.deploymentId is not set — deployment links will not appear');
    (APP_CONFIG.tabs || []).forEach((tab, i) => {
        if (!tab.key)     errors.push(`tabs[${i}] missing key`);
        if (!tab.file)    errors.push(`tabs[${i}] missing file`);
        if (!tab.dataKey) errors.push(`tabs[${i}] missing dataKey`);
    });
    if (errors.length) {
        const msg = 'APP_CONFIG errors:\n' + errors.map(e => `  • ${e}`).join('\n');
        console.error(msg);
        // defer alert so DOM is ready
        window.addEventListener('load', () => alert(msg), { once: true });
        throw new Error(msg);
    }
})();

// ── Derived constants  ────────────────────────────────────────────────────────

const PRIMARY_TAB = APP_CONFIG.tabs.find(t => t.isPrimary);
const LINK_FIELD  = APP_CONFIG.linkField;
const GEOM_FIELD  = APP_CONFIG.geometryField;
const LABEL_FIELD = APP_CONFIG.labelField;
const DEPTH_FIELD = APP_CONFIG.depthField;

// Pre-compute computed-link lookup: fieldName → config entry
const COMPUTED_LINK_MAP = {};
(APP_CONFIG.computedLinks || []).forEach(def => {
    COMPUTED_LINK_MAP[def.field] = def;
});


// ── Dynamic CSS  ──────────────────────────────────────────────────────────────

(function injectBrandStyles() {
    const style = document.createElement('style');
    style.textContent = `:root { --brand-color: ${APP_CONFIG.brandColor}; }`;
    document.head.appendChild(style);
})();


// ── Application state  ────────────────────────────────────────────────────────

const appState = {
    allData:              {},
    filteredData:         {},
    sortState:            {},
    searchState:          {},
    rangeState:           {},
    layers:               [],   // Leaflet layers (circleMarker or polygon)
    activeSpecialFilter:  null,
    hiddenTabs:           new Set(), // keys of currently hidden tabs
    dropdownState:        {},   // tab.key → col → Set of selected values
    dropdownOptions:      {},   // tab.key → col → sorted Array of available values
    geomCache:            new Map(), // LINK_FIELD → {type, ...} — built once after loadData
    geomType:             null,      // 'point' | 'polygon' — detected from first record
    legendValues:         new Set(), // unique colorField values — collected during cache build
    numericFieldCache:    {},
    clusterGroup:         null,
    virtualRows:          {},
    _rafPending:          {},
    _headerBuilt:         {},
    specialFilterIds:     {},
    deployments:          [],   // [{title, url, icon}] loaded from deployments.json
    deploymentLinks:      [],   // [{sourceTab,sourceColumn,targetTitle,targetUrl,targetTab,targetColumn,icon}]
};

APP_CONFIG.tabs.forEach(tab => {
    appState.allData[tab.key]         = [];
    appState.filteredData[tab.key]    = [];
    appState.sortState[tab.key]       = {};
    appState.searchState[tab.key]     = {};
    appState.rangeState[tab.key]      = {};
    appState.dropdownState[tab.key]   = {};
    appState.dropdownOptions[tab.key] = {};
});


// ════════════════════════════════════════════════════════════════════════════
// BUILD UI
// Generates all dynamic HTML from APP_CONFIG — header buttons, tab buttons,
// tab panes, and table scaffolds.
// ════════════════════════════════════════════════════════════════════════════

function buildUI() {
    buildDeploymentSwitcher();
    document.title = APP_CONFIG.title;

    // ── Header buttons ────────────────────────────────────────────────────
    const btnContainer = document.getElementById('header-buttons-container');

    const clearBtn = document.createElement('button');
    clearBtn.id = 'clear-filters-btn';
    clearBtn.className = 'filter-btn';
    clearBtn.textContent = 'Clear All Filters';
    btnContainer.appendChild(clearBtn);

    // ── Data Filters dropdown (replaces individual special filter buttons) ──
    const specialTabs = APP_CONFIG.tabs.filter(t => t.specialFilter);
    if (specialTabs.length > 0) {
        const dfWrapper = document.createElement('div');
        dfWrapper.className = 'data-filters-wrapper';
        dfWrapper.id        = 'data-filters-wrapper';

        const dfBtn = document.createElement('button');
        dfBtn.id        = 'data-filters-btn';
        dfBtn.className = 'filter-btn data-filters-btn';
        dfBtn.innerHTML = '<i class="fas fa-filter" aria-hidden="true"></i> <span id="data-filters-label">Data Filters</span> <span class="btn-chevron">&#9662;</span>';
        dfWrapper.appendChild(dfBtn);

        const dfMenu = document.createElement('div');
        dfMenu.className = 'header-dropdown-menu';
        dfMenu.id        = 'data-filters-menu';

        specialTabs.forEach(tab => {
            const item = document.createElement('button');
            item.id        = `special-filter-${tab.key}`;
            item.className = 'header-dropdown-item special-filter-item';
            item.dataset.tabKey = tab.key;
            item.innerHTML = `<span class="dropdown-item-check" id="sf-check-${tab.key}"></span>${tab.specialFilter}`;
            dfMenu.appendChild(item);
        });

        dfWrapper.appendChild(dfMenu);
        btnContainer.appendChild(dfWrapper);
    }

    // ── Tabs manager button ───────────────────────────────────────────────
    const hideableTabs = APP_CONFIG.tabs.filter(t => t.hideable && !t.isPrimary);
    if (hideableTabs.length > 0) {
        const tabsWrapper = document.createElement('div');
        tabsWrapper.className = 'tabs-manager-wrapper';
        tabsWrapper.id        = 'tabs-manager-wrapper';

        const tabsBtn = document.createElement('button');
        tabsBtn.id        = 'tabs-manager-btn';
        tabsBtn.className = 'filter-btn tabs-manager-btn';
        tabsBtn.innerHTML = '<i class="fas fa-gear" aria-hidden="true"></i> Tabs <span class="btn-chevron">&#9662;</span>';
        tabsWrapper.appendChild(tabsBtn);

        const tabsMenu = document.createElement('div');
        tabsMenu.className = 'header-dropdown-menu';
        tabsMenu.id        = 'tabs-manager-menu';

        hideableTabs.forEach(tab => {
            const item = document.createElement('button');
            item.className      = 'header-dropdown-item tabs-manager-item';
            item.dataset.tabKey = tab.key;
            item.innerHTML = `<span class="dropdown-item-check visible" id="tab-vis-check-${tab.key}"><i class="fas fa-check" aria-hidden="true"></i></span><i class="fas ${tab.icon}" aria-hidden="true"></i> ${tab.label}`;
            tabsMenu.appendChild(item);
        });

        tabsWrapper.appendChild(tabsMenu);
        btnContainer.appendChild(tabsWrapper);
    }

    const zoomBtn = document.createElement('button');
    zoomBtn.id = 'zoom-extents-btn';
    zoomBtn.className = 'filter-btn';
    zoomBtn.title = 'Zoom to full data extents';
    zoomBtn.innerHTML = '&#9654; Zoom to All';
    btnContainer.appendChild(zoomBtn);

    const exportWrapper = document.createElement('div');
    exportWrapper.className = 'export-wrapper';
    exportWrapper.innerHTML = `
        <button id="export-btn" class="filter-btn" title="Export tables to Excel">
            &#8681; Export &#9662;
        </button>
        <div class="export-dropdown" id="export-dropdown">
            <button class="export-option" id="export-all-btn">
                All rows for visible ${PRIMARY_TAB.label}
            </button>
            <button class="export-option" id="export-filtered-btn">
                Filtered rows only
            </button>
        </div>`;
    btnContainer.appendChild(exportWrapper);

    const copyLinkBtn = document.createElement('button');
    copyLinkBtn.id        = 'copy-link-btn';
    copyLinkBtn.className = 'filter-btn';
    copyLinkBtn.title     = 'Copy a link to the current filtered view';
    copyLinkBtn.innerHTML = '&#128279; Copy Link';
    btnContainer.appendChild(copyLinkBtn);

    // ── Tab buttons and panes ─────────────────────────────────────────────
    const tabsHeader  = document.getElementById('tabs-header');
    const tabsContent = document.getElementById('tabs-content');

    APP_CONFIG.tabs.forEach((tab, idx) => {
        const btn = document.createElement('button');
        btn.className   = 'tab-button' + (idx === 0 ? ' active' : '');
        btn.dataset.tab = tab.key;
        btn.id          = `tab-btn-${tab.key}`;
        btn.setAttribute('aria-selected', idx === 0 ? 'true' : 'false');
        btn.setAttribute('aria-controls', `tab-pane-${tab.key}`);
        btn.innerHTML = `<i class="fas ${tab.icon}" aria-hidden="true"></i> ${tab.label} <span class="tab-count" id="tab-count-${tab.key}"></span>`;

        // Help icon — only rendered when tab.help is defined
        if (tab.help) {
            // The trigger is a child of the tab button so it never interrupts
            // keyboard navigation. tabindex="-1" keeps it out of the tab order.
            // The popup is shown/hidden by click only (not hover or focus-within)
            // so keyboard users aren't shown it automatically on tab focus.
            const trigger = document.createElement('span');
            trigger.className = 'tab-help-trigger';
            trigger.setAttribute('tabindex', '-1');
            trigger.setAttribute('aria-hidden', 'true');

            const icon = document.createElement('i');
            icon.className = 'fas fa-question-circle';
            icon.setAttribute('aria-hidden', 'true');

            const popup = document.createElement('div');
            popup.className = 'tab-help-popup';
            popup.setAttribute('role', 'dialog');
            popup.setAttribute('id', `tab-help-popup-${tab.key}`);

            if (tab.help.title || tab.label) {
                const title = document.createElement('strong');
                title.className = 'tab-help-title';
                title.textContent = tab.help.title || tab.label;
                popup.appendChild(title);
            }

            const body = document.createElement('div');
            body.className = 'tab-help-body';

            // Accept plain text or HTML
            if (/<[a-z][\s\S]*>/i.test(tab.help.content || '')) {
                body.innerHTML = tab.help.content;
            } else {
                body.textContent = tab.help.content || '';
            }

            // Auto-link bare URLs in text nodes, and ensure all <a> tags
            // (whether from HTML content or auto-linked) open in a new tab.
            body.querySelectorAll('a').forEach(a => {
                a.target = '_blank';
                a.rel    = 'noopener noreferrer';
            });
            // Walk text nodes and linkify bare URLs
            const urlRe = /https?:\/\/[^\s<>"]+/g;
            const walker = document.createTreeWalker(body, NodeFilter.SHOW_TEXT);
            const textNodes = [];
            let node;
            while ((node = walker.nextNode())) textNodes.push(node);
            textNodes.forEach(tn => {
                if (!urlRe.test(tn.nodeValue)) return;
                urlRe.lastIndex = 0;
                const frag = document.createDocumentFragment();
                let last = 0, m;
                while ((m = urlRe.exec(tn.nodeValue)) !== null) {
                    if (m.index > last) frag.appendChild(document.createTextNode(tn.nodeValue.slice(last, m.index)));
                    const a = document.createElement('a');
                    a.href   = m[0];
                    a.target = '_blank';
                    a.rel    = 'noopener noreferrer';
                    a.textContent = m[0];
                    frag.appendChild(a);
                    last = m.index + m[0].length;
                }
                if (last < tn.nodeValue.length) frag.appendChild(document.createTextNode(tn.nodeValue.slice(last)));
                tn.parentNode.replaceChild(frag, tn);
            });

            popup.appendChild(body);
            trigger.appendChild(icon);
            trigger.appendChild(popup);
            btn.appendChild(trigger);

            // Position the fixed popup via JS so it is never clipped by overflow:hidden.
            const positionPopup = () => {
                const rect = trigger.getBoundingClientRect();
                popup.style.top  = (rect.bottom + 6) + 'px';
                const idealLeft  = rect.left + rect.width / 2 - 140;
                const maxLeft    = window.innerWidth - 296;
                popup.style.left = Math.max(4, Math.min(idealLeft, maxLeft)) + 'px';
            };

            // Toggle open on click; close on outside click or Escape.
            trigger.addEventListener('click', e => {
                e.stopPropagation();
                const isOpen = trigger.classList.toggle('open');
                if (isOpen) {
                    positionPopup();
                    // Close any other open help popups
                    document.querySelectorAll('.tab-help-trigger.open').forEach(t => {
                        if (t !== trigger) t.classList.remove('open');
                    });
                }
            });

            // Close on Escape key while the parent button has focus
            btn.addEventListener('keydown', e => {
                if (e.key === 'Escape') trigger.classList.remove('open');
            });

            // Prevent clicks inside the popup propagating to the document listener
            popup.addEventListener('click', e => e.stopPropagation());
        }

        tabsHeader.appendChild(btn);

        const pane = document.createElement('div');
        pane.className  = 'tab-pane' + (idx === 0 ? ' active' : '');
        pane.dataset.tab = tab.key;
        pane.id          = `tab-pane-${tab.key}`;
        pane.setAttribute('tabindex', '0');
        pane.innerHTML = `
            <div class="table-wrapper" id="${tab.key}-wrapper">
                <table id="${tab.key}-table" aria-label="${tab.label}"${APP_CONFIG.truncateCells !== false ? ' class="truncate-cells"' : ''}>
                    <thead><tr id="${tab.key}-header"></tr></thead>
                    <tbody id="${tab.key}-body">
                        <tr id="${tab.key}-spacer-top"></tr>
                        <tr id="${tab.key}-spacer-bottom"></tr>
                    </tbody>
                </table>
                <div id="${tab.key}-empty" class="no-data" role="status">No data to display</div>
            </div>`;
        tabsContent.appendChild(pane);
    });
}


// ════════════════════════════════════════════════════════════════════════════
// MAP
// ════════════════════════════════════════════════════════════════════════════

let map;

function initMap() {
    try {
        if (!proj4.defs(APP_CONFIG.projection)) {
            // Register from APP_CONFIG.projectionDef if supplied, otherwise
            // fall back to the built-in Irish Grid definition for EPSG:29902.
            const projDef = APP_CONFIG.projectionDef ||
                '+proj=tmerc +lat_0=53.5 +lon_0=-8 +k=1.000035 ' +
                '+x_0=200000 +y_0=250000 +datum=ire65 +units=m +no_defs';
            proj4.defs(APP_CONFIG.projection, projDef);
        }

        map = L.map('map', {
            zoom:   APP_CONFIG.mapZoom,
            center: APP_CONFIG.mapCenter,
        });

        const osmLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap contributors', maxZoom: 19,
        });
        const satelliteLayer = L.tileLayer(
            'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
            { attribution: '© Esri', maxZoom: 19 }
        );
        const topoLayer = L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenTopoMap', maxZoom: 17,
        });

        osmLayer.addTo(map);
        L.control.layers(
            { 'OpenStreetMap': osmLayer, 'Satellite': satelliteLayer, 'Topographic': topoLayer },
            null,
            { position: 'topright' }
        ).addTo(map);

        if (APP_CONFIG.clustering) {
            // Cluster group is only added to the map after loadData sets geomType.
            // We create the group here so it exists, but only attach it if data is points.
            appState.clusterGroup = L.markerClusterGroup({ chunkedLoading: true });
        }

        map.on('moveend', () => {
            applyBoundsFilter();
        });
    } catch (err) {
        console.error('Error initializing map:', err);
    }
}

// Global zoom handler for popup links — Leaflet popups use HTML strings so
// click handlers must reference a global function via onclick attribute.
window.__zoomToId = function(linkId) {
    const cached = appState.geomCache.get(linkId);
    if (!cached) return;
    map.closePopup();
    if (cached.type === 'point')   map.setView(cached.latLng, 14);
    if (cached.type === 'polygon') map.fitBounds(cached.bounds, { padding: [20, 20] });
};

// ════════════════════════════════════════════════════════════════════════════
// GEOMETRY — parsing, projection, and cache
//
// Supports POINT, POLYGON, and MULTIPOLYGON WKT from Irish Grid (or any
// proj4-registered CRS). All projection work happens once at load time;
// every subsequent operation reads from geomCache.
// ════════════════════════════════════════════════════════════════════════════

function detectGeomType(wktString) {
    if (!wktString) return null;
    if (wktString.startsWith('POINT'))        return 'point';
    if (wktString.startsWith('MULTIPOLYGON')) return 'multipolygon';
    if (wktString.startsWith('POLYGON'))      return 'polygon';
    return null;
}

// ── Point ─────────────────────────────────────────────────────────────────

function parseGeomPoint(geomString) {
    const m = geomString.match(/POINT\s*\(\s*([\d.]+)\s+([\d.]+)\s*\)/);
    return m ? { easting: parseFloat(m[1]), northing: parseFloat(m[2]) } : null;
}

function projectPoint(easting, northing) {
    const [lng, lat] = proj4(APP_CONFIG.projection, 'WGS84', [easting, northing]);
    return L.latLng(lat, lng);
}

// ── Polygon ───────────────────────────────────────────────────────────────

// Extracts all rings from a POLYGON or MULTIPOLYGON WKT string.
// Returns an array of rings, each ring being an array of [easting, northing].
// Works for both types — the regex captures every parenthesised coordinate list.
function parseWktRings(wktString) {
    const rings = [];
    const ringPattern = /\(([^()]+)\)/g;
    let match;
    while ((match = ringPattern.exec(wktString)) !== null) {
        const coords = match[1].trim().split(',').map(pair => {
            const parts = pair.trim().split(/\s+/);
            return [parseFloat(parts[0]), parseFloat(parts[1])];
        });
        rings.push(coords);
    }
    return rings;
}

function projectRing(coords) {
    return coords.map(([e, n]) => {
        const [lng, lat] = proj4(APP_CONFIG.projection, 'WGS84', [e, n]);
        return L.latLng(lat, lng);
    });
}

// ── Unified cache builder ─────────────────────────────────────────────────
// Called once per primary record during loadData.
// Returns a cache entry object or null if geometry is missing/unrecognised.

function buildGeomCacheEntry(wktString) {
    const type = detectGeomType(wktString);
    if (!type) return null;

    if (type === 'point') {
        const pt = parseGeomPoint(wktString);
        if (!pt) return null;
        const latLng = projectPoint(pt.easting, pt.northing);
        return { type: 'point', latLng };
    }

    // polygon or multipolygon
    const rawRings   = parseWktRings(wktString);
    const projRings  = rawRings.map(projectRing);
    // Pre-compute bounds from all projected vertices for fast intersection tests
    const allLatLngs = projRings.flat();
    const bounds     = L.latLngBounds(allLatLngs);
    return { type: 'polygon', rings: projRings, bounds };
}

// ── Visibility test ───────────────────────────────────────────────────────
// Used by applyBoundsFilter on every pan/zoom.

function isVisible(linkId, mapBounds) {
    const cached = appState.geomCache.get(linkId);
    if (!cached) return false;
    if (cached.type === 'point')   return mapBounds.contains(cached.latLng);
    if (cached.type === 'polygon') return mapBounds.intersects(cached.bounds);
    return false;
}

// ════════════════════════════════════════════════════════════════════════════
// DATA LOADING
// ════════════════════════════════════════════════════════════════════════════

function showLoadingState() {
    APP_CONFIG.tabs.forEach(tab => {
        const empty = document.getElementById(`${tab.key}-empty`);
        if (empty) {
            empty.textContent = 'Loading…';
            empty.className   = 'no-data loading';
            empty.style.display = 'block';
        }
    });
}

function showTabError(tabKey, message) {
    const empty = document.getElementById(`${tabKey}-empty`);
    if (empty) {
        empty.textContent = `Failed to load data: ${message}`;
        empty.style.display = 'block';
        empty.style.color   = '#c0392b';
    }
    const countEl = document.getElementById(`tab-count-${tabKey}`);
    if (countEl) countEl.textContent = '(error)';
}

function loadData() {
    showLoadingState();

    // Load deployments.json and deploymentlinks.json (both optional — silently ignored if absent)
    const fetchJson = url =>
        fetch(url).then(r => r.ok ? r.json() : []).catch(() => []);

    const deploymentsFetch     = fetchJson('/deployments.json')
        .then(data => { appState.deployments     = Array.isArray(data) ? data : []; });
    const deploymentLinksFetch = fetchJson('/deploymentlinks.json')
        .then(data => { appState.deploymentLinks = Array.isArray(data) ? data : []; });

    // Fetch each tab independently so a single failure doesn't block the rest.
    const fetches = APP_CONFIG.tabs.map(tab =>
        fetch(tab.file)
            .then(r => {
                if (!r.ok) throw new Error(`HTTP ${r.status}`);
                return r.json();
            })
            .then(data => ({ key: tab.key, rows: data[tab.dataKey] || [], error: null }))
            .catch(err => ({ key: tab.key, rows: [], error: err.message }))
    );

    return Promise.all([deploymentsFetch, deploymentLinksFetch, ...fetches]).then(([,, ...results]) => {
        results.forEach(({ key, rows, error }) => {
            if (error) {
                showTabError(key, error);
            }
            appState.allData[key] = rows;
        });

        // Build label lookup from primary tab, then prepend the label field
        // to every sibling tab row so it appears as the first column.
        const labelMap = new Map();
        appState.allData[PRIMARY_TAB.key].forEach(row => {
            labelMap.set(row[LINK_FIELD], row[LABEL_FIELD]);
        });

        APP_CONFIG.tabs.filter(t => !t.isPrimary).forEach(tab => {
            appState.allData[tab.key] = appState.allData[tab.key].map(item => ({
                [LABEL_FIELD]: labelMap.get(item[LINK_FIELD]) || '—',
                ...item,
            }));
        });

        APP_CONFIG.tabs.forEach(tab => {
            appState.filteredData[tab.key] = [...appState.allData[tab.key]];
        });

        // ── Geometry cache ────────────────────────────────────────────────
        // Project all primary geometries once. Detect the deployment's geometry
        // type from the first record with a non-null geometry field.
        const colorField = APP_CONFIG.symbology?.colorField;

        appState.allData[PRIMARY_TAB.key].forEach(row => {
            const wkt   = row[GEOM_FIELD];
            const entry = buildGeomCacheEntry(wkt);
            if (!entry) return;

            // Set geomType from first successfully parsed record
            if (!appState.geomType) appState.geomType = entry.type;

            appState.geomCache.set(row[LINK_FIELD], entry);

            // Collect unique values for the categorical legend
            if (colorField && row[colorField] !== null && row[colorField] !== undefined) {
                appState.legendValues.add(String(row[colorField]));
            }
        });

        // Classify numeric fields once per tab — the result never changes
        // since the data shape is fixed after load.
        APP_CONFIG.tabs.forEach(tab => {
            appState.numericFieldCache[tab.key] = getNumericFields(appState.allData[tab.key]);
        });

        // Pre-compute the set of LINK_FIELD values present in each special-filter
        // tab so applyBoundsFilter doesn't rebuild it on every pan/zoom.
        APP_CONFIG.tabs.filter(t => t.specialFilter).forEach(tab => {
            appState.specialFilterIds[tab.key] = new Set(
                appState.allData[tab.key].map(item => item[LINK_FIELD]).filter(Boolean)
            );
        });

    });
}


// ════════════════════════════════════════════════════════════════════════════
// COLOUR + LEGEND
// ════════════════════════════════════════════════════════════════════════════

// Point deployments — depth-based colour from depthClasses
function getDepthColor(depthValue) {
    if (!APP_CONFIG.depthClasses?.length) return '#3498db';
    const d = parseFloat(depthValue);
    if (isNaN(d) || d <= 0) return APP_CONFIG.depthClasses[0].fill;
    for (let i = 1; i < APP_CONFIG.depthClasses.length; i++) {
        if (d < APP_CONFIG.depthClasses[i].max) return APP_CONFIG.depthClasses[i].fill;
    }
    return APP_CONFIG.depthClasses[APP_CONFIG.depthClasses.length - 1].fill;
}

// Polygon deployments — stable hue derived from colorField value string
function stringToHue(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    return Math.abs(hash) % 360;
}

function getPolygonColor(row) {
    const field = APP_CONFIG.symbology?.colorField;
    const value = field ? String(row[field] ?? 'Unknown') : 'Unknown';
    return `hsl(${stringToHue(value)}, 65%, 40%)`;
}

function buildLegend() {
    const el = document.getElementById('depth-legend');

    // Categorical legend for polygon deployments
    if (APP_CONFIG.symbology) {
        if (APP_CONFIG.symbology.showLegend === false) {
            el.style.display = 'none';
            return;
        }
        const colorField = APP_CONFIG.symbology.colorField || 'Value';
        el.innerHTML = `<h4>${colorField}</h4>` +
            [...appState.legendValues].sort().map(val =>
                `<div class="legend-item">` +
                `<span class="legend-swatch" style="background:hsl(${stringToHue(val)},65%,40%)"></span>` +
                `<span>${val}</span></div>`
            ).join('');
        return;
    }

    // Depth legend for point deployments
    if (APP_CONFIG.clustering) {
        el.style.display = 'none';
        return;
    }
    el.innerHTML =
        `<h4>${DEPTH_FIELD}</h4>` +
        (APP_CONFIG.depthClasses || []).map(cls =>
            `<div class="legend-item">` +
            `<span class="legend-swatch" style="background:${cls.fill}"></span>` +
            `<span>${cls.label}</span></div>`
        ).join('');
}



// ════════════════════════════════════════════════════════════════════════════
// DEPLOYMENT SWITCHER & DEPLOYMENT LINKS
// ════════════════════════════════════════════════════════════════════════════

// Build the URL for a deployment link: target base URL + hash encoding a
// pre-applied text filter on the target tab/column for the given value.
// The hash format matches this app's own URL state schema so the target
// deployment opens with the filter already active.
// Build the hash-encoded URL for a deployment link.
// filterType 'dropdown' encodes as a dropdown selection (array);
// filterType 'text' encodes as a text search string.
// This is explicit in deploymentlinks.json so cross-type links work correctly
// regardless of how either deployment's APP_CONFIG is configured.
function buildDeploymentLinkUrl(targetUrl, targetTab, targetColumn, value, filterType) {
    const state = (filterType === 'dropdown')
        ? { dropdown: { [targetTab]: { [targetColumn]: [value] } } }
        : { search:   { [targetTab]: { [targetColumn]: value  } } };
    const hash = btoa(unescape(encodeURIComponent(JSON.stringify(state))));
    return targetUrl.replace(/\/$/, '') + '#' + hash;
}

// Append inline icon links to `parentEl` for every deploymentlinks.json entry
// whose sourceDeployment + sourceTab + sourceColumn matches this cell.
// Icons are appended inside <td> elements and inserted as siblings for inline
// elements (e.g. <strong>/<small> in popups).
function appendDeploymentLinkIcons(parentEl, tabKey, colKey, value) {
    if (!value && value !== 0) return;
    const str      = String(value).replace(/^"|"$/g, '').trim();
    const isInline = parentEl.tagName !== 'TD' && parentEl.tagName !== 'TH';
    appState.deploymentLinks.forEach(link => {
        // Filter to entries for this deployment, tab, and column
        if (link.sourceDeployment !== APP_CONFIG.deploymentId) return;
        if (link.sourceTab        !== tabKey)                   return;
        if (link.sourceColumn     !== colKey)                   return;

        // Look up target deployment in deployments.json for URL and title
        const targetDep = appState.deployments.find(d => d.id === link.targetDeployment);
        if (!targetDep) return;

        const url = buildDeploymentLinkUrl(
            targetDep.url, link.targetTab, link.targetColumn, str, link.filterType
        );
        const a = document.createElement('a');
        a.href      = url;
        a.target    = '_blank';
        a.rel       = 'noopener noreferrer';
        a.className = 'deployment-link-icon';
        a.setAttribute('aria-label', `search ${str} in ${targetDep.title}`);
        a.title = `Search in ${targetDep.title}`;
        const icon = document.createElement('i');
        icon.className = link.icon || 'fas fa-external-link-alt';
        icon.setAttribute('aria-hidden', 'true');
        a.appendChild(icon);
        if (isInline) {
            parentEl.insertAdjacentElement('afterend', a);
        } else {
            parentEl.appendChild(a);
        }
    });
}

// Build the deployment switcher that replaces the <h1>.
// Renders immediately with APP_CONFIG.title; dropdown populates once
// appState.deployments is loaded (deployments.json fetch resolves after buildUI).
function buildDeploymentSwitcher() {
    const h1 = document.getElementById('app-title');
    if (!h1) return;

    const wrapper = document.createElement('div');
    wrapper.className = 'deployment-switcher';
    wrapper.id        = 'deployment-switcher';
    // Remove the id from the <h1> placeholder before replacing it so that
    // nothing can accidentally target 'app-title' after the switcher is in place.
    h1.removeAttribute('id');

    // Button — always visible, shows current title
    const btn = document.createElement('button');
    btn.className = 'deployment-switcher-btn';
    btn.id        = 'deployment-switcher-btn';
    btn.setAttribute('aria-haspopup', 'listbox');
    btn.setAttribute('aria-expanded', 'false');

    const titleSpan = document.createElement('span');
    titleSpan.className = 'deployment-switcher-title';
    titleSpan.textContent = APP_CONFIG.title;
    btn.appendChild(titleSpan);

    const chevron = document.createElement('i');
    chevron.className = 'fas fa-chevron-down deployment-switcher-chevron';
    chevron.setAttribute('aria-hidden', 'true');
    btn.appendChild(chevron);

    // Dropdown list — rendered empty; populated by populateDeploymentSwitcher()
    const list = document.createElement('ul');
    list.className = 'deployment-switcher-list';
    list.id        = 'deployment-switcher-list';
    list.setAttribute('role', 'listbox');
    list.hidden = true;

    wrapper.appendChild(btn);
    wrapper.appendChild(list);
    h1.replaceWith(wrapper);

    // Toggle on button click
    btn.addEventListener('click', e => {
        e.stopPropagation();
        const open = !list.hidden;
        list.hidden = open;
        btn.setAttribute('aria-expanded', String(!open));
        chevron.className = `fas fa-chevron-${open ? 'down' : 'up'} deployment-switcher-chevron`;
    });

    // Close on outside click
    document.addEventListener('click', () => {
        list.hidden = true;
        btn.setAttribute('aria-expanded', 'false');
        chevron.className = 'fas fa-chevron-down deployment-switcher-chevron';
    });

    // Escape also closes
    document.addEventListener('keydown', e => {
        if (e.key === 'Escape' && !list.hidden) {
            list.hidden = true;
            btn.setAttribute('aria-expanded', 'false');
            chevron.className = 'fas fa-chevron-down deployment-switcher-chevron';
        }
    });

    list.addEventListener('click', e => e.stopPropagation());
}

// Called once appState.deployments has loaded. Populates the dropdown list.
// The current deployment is identified by URL prefix match and shown as active.
function populateDeploymentSwitcher() {
    const list = document.getElementById('deployment-switcher-list');
    const btn  = document.getElementById('deployment-switcher-btn');
    if (!list) return;

    const currentHref = window.location.href.split('#')[0];

    // Hide the chevron if there are no entries to show
    if (appState.deployments.length === 0) {
        const chevron = btn?.querySelector('.deployment-switcher-chevron');
        if (chevron) chevron.style.display = 'none';
        return;
    }

    list.innerHTML = '';
    appState.deployments.forEach(dep => {
        const depBase   = dep.url.replace(/\/$/, '');
        const isCurrent = currentHref.startsWith(depBase) ||
                          depBase.startsWith(currentHref.replace(/\/[^/]*$/, ''));

        const li = document.createElement('li');
        li.setAttribute('role', 'option');
        li.setAttribute('aria-selected', String(isCurrent));

        const a = document.createElement('a');
        a.href      = dep.url;
        a.className = 'deployment-switcher-item' + (isCurrent ? ' current' : '');

        if (dep.icon) {
            const icon = document.createElement('i');
            icon.className = dep.icon;
            icon.setAttribute('aria-hidden', 'true');
            a.appendChild(icon);
        }

        const label = document.createElement('span');
        label.textContent = dep.title;
        a.appendChild(label);

        if (isCurrent) {
            const tick = document.createElement('i');
            tick.className = 'fas fa-check deployment-switcher-current-tick';
            tick.setAttribute('aria-hidden', 'true');
            a.appendChild(tick);
        }

        li.appendChild(a);
        list.appendChild(li);
    });
}


// ════════════════════════════════════════════════════════════════════════════
// DATA FILTERS & TAB VISIBILITY HELPERS
// ════════════════════════════════════════════════════════════════════════════

// Update the Data Filters button label to reflect the active special filter.
// Shows "Data Filters: [name] ▾" when one is active, "Data Filters ▾" otherwise.
// Also marks the active item in the dropdown with a check.
function updateDataFiltersBtn() {
    const labelEl = document.getElementById('data-filters-label');
    const btn     = document.getElementById('data-filters-btn');
    if (!labelEl || !btn) return;

    const activeTab = appState.activeSpecialFilter
        ? APP_CONFIG.tabs.find(t => t.key === appState.activeSpecialFilter)
        : null;

    labelEl.textContent = activeTab
        ? `Data Filters: ${activeTab.specialFilter}`
        : 'Data Filters';

    btn.classList.toggle('active', !!activeTab);

    // Update check marks on dropdown items
    APP_CONFIG.tabs.filter(t => t.specialFilter).forEach(tab => {
        const check = document.getElementById(`sf-check-${tab.key}`);
        if (check) {
            check.innerHTML = appState.activeSpecialFilter === tab.key
                ? '<i class="fas fa-check" aria-hidden="true"></i>'
                : '';
        }
    });
}

// Show or hide a tab button and pane based on appState.hiddenTabs.
// Hidden tabs remain in the DOM — their data loads and filters apply normally.
function applyTabVisibility() {
    APP_CONFIG.tabs.filter(t => t.hideable && !t.isPrimary).forEach(tab => {
        const isHidden = appState.hiddenTabs.has(tab.key);
        const tabBtn   = document.getElementById(`tab-btn-${tab.key}`);
        const tabPane  = document.getElementById(`tab-pane-${tab.key}`);
        const check    = document.getElementById(`tab-vis-check-${tab.key}`);

        if (tabBtn)  tabBtn.style.display  = isHidden ? 'none' : '';
        if (tabPane) {
            if (isHidden && tabPane.classList.contains('active')) {
                // If hiding the active tab, switch to the first visible tab
                tabPane.classList.remove('active');
                const firstVisible = APP_CONFIG.tabs.find(t => {
                    if (t.key === tab.key) return false;
                    return !appState.hiddenTabs.has(t.key);
                });
                if (firstVisible) {
                    document.getElementById(`tab-pane-${firstVisible.key}`)?.classList.add('active');
                    document.getElementById(`tab-btn-${firstVisible.key}`)?.classList.add('active');
                    document.getElementById(`tab-btn-${firstVisible.key}`)?.setAttribute('aria-selected', 'true');
                }
                tabBtn?.classList.remove('active');
                tabBtn?.setAttribute('aria-selected', 'false');
            }
            tabPane.style.display = isHidden ? 'none' : '';
        }
        if (check) {
            check.innerHTML = isHidden
                ? ''
                : '<i class="fas fa-check" aria-hidden="true"></i>';
        }
    });
}

// ════════════════════════════════════════════════════════════════════════════
// MAP MARKERS
// ════════════════════════════════════════════════════════════════════════════

function buildPopupContent(row) {
    const linkId    = row[LINK_FIELD];
    const container = document.createElement('div');

    APP_CONFIG.popupFields.forEach(def => {
        // Special entry: zoom link
        if (def.type === 'zoomLink') {
            const a = document.createElement('a');
            a.href      = '#';
            a.className = 'popup-zoom-link';
            a.setAttribute('aria-label', def.label || 'Zoom to site');
            const icon = document.createElement('i');
            icon.className = 'fas fa-search-location';
            icon.setAttribute('aria-hidden', 'true');
            a.appendChild(icon);
            a.appendChild(document.createTextNode(' ' + (def.label || 'Zoom to site')));
            a.addEventListener('click', e => {
                e.preventDefault();
                window.__zoomToId(linkId);
            });
            if (container.children.length) container.appendChild(document.createElement('br'));
            container.appendChild(a);
            return;
        }

        const val = row[def.field];
        if (val === null || val === undefined) return;

        const text = (def.label ? def.label + ': ' : '') + val + (def.suffix || '');
        const el   = document.createElement(def.bold ? 'strong' : 'small');
        el.textContent = text;

        if (container.children.length) container.appendChild(document.createElement('br'));
        container.appendChild(el);

        // Deployment links: icon per matching deploymentlinks.json entry for this field
        appendDeploymentLinkIcons(el, PRIMARY_TAB.key, def.field, val);
    });

    return container;
}


function createLayer(row) {
    const cached = appState.geomCache.get(row[LINK_FIELD]);
    if (!cached) return null;

    let layer;
    if (cached.type === 'point') {
        layer = L.circleMarker(cached.latLng, {
            radius:      6,
            fillColor:   getDepthColor(row[DEPTH_FIELD]),
            color:       '#00000044',
            weight:      1,
            opacity:     1,
            fillOpacity: 0.85,
        });
    } else {
        // polygon or multipolygon — rings already projected to L.latLng[]
        layer = L.polygon(cached.rings, {
            color:       getPolygonColor(row),
            weight:      APP_CONFIG.symbology?.strokeWidth ?? 2,
            opacity:     1,
            fillOpacity: APP_CONFIG.symbology?.fillOpacity ?? 0,
        });
    }

    layer.bindPopup(buildPopupContent(row));
    layer.featureId = row[LINK_FIELD];
    return layer;
}

// Adds layers to the cluster group (points only) or directly to the map.
// Clustering is silently bypassed for polygon geometry.
function addLayers(layers) {
    const useCluster = APP_CONFIG.clustering && appState.geomType === 'point';
    if (useCluster) {
        appState.clusterGroup.addLayers(layers);
    } else {
        layers.forEach(l => l.addTo(map));
    }
    appState.layers.push(...layers);
}

// Removes all layers from the cluster group or map.
function clearLayers() {
    const useCluster = APP_CONFIG.clustering && appState.geomType === 'point';
    if (useCluster) {
        appState.clusterGroup.clearLayers();
    } else {
        appState.layers.forEach(l => map.removeLayer(l));
    }
    appState.layers = [];
}

function plotLocations() {
    clearLayers();

    const filteredIds = new Set(
        appState.filteredData[PRIMARY_TAB.key].map(r => r[LINK_FIELD])
    );

    const layers = [];
    appState.allData[PRIMARY_TAB.key].forEach(row => {
        if (!filteredIds.has(row[LINK_FIELD])) return;
        const layer = createLayer(row);
        if (layer) layers.push(layer);
    });

    addLayers(layers);
    updateLayerCount();
}

function updateLayerCount() {
    // Polygons and unclustered points: count layers whose geometry intersects bounds.
    // Clustered points: count all layers since clustering manages visibility.
    const useCluster = APP_CONFIG.clustering && appState.geomType === 'point';
    const count = useCluster
        ? appState.layers.length
        : (() => {
            const bounds = map.getBounds();
            return appState.layers.filter(l => {
                const cached = appState.geomCache.get(l.featureId);
                if (!cached) return false;
                if (cached.type === 'point')   return bounds.contains(cached.latLng);
                if (cached.type === 'polygon') return bounds.intersects(cached.bounds);
                return false;
            }).length;
        })();
    document.getElementById('visible-count').textContent = count;
}


// ════════════════════════════════════════════════════════════════════════════
// MAP-BOUNDS FILTERING
// ════════════════════════════════════════════════════════════════════════════

function applyBoundsFilter() {
    const bounds = map.getBounds();
    const visibleIds = new Set();

    appState.allData[PRIMARY_TAB.key].forEach(row => {
        if (isVisible(row[LINK_FIELD], bounds)) visibleIds.add(row[LINK_FIELD]);
    });

    if (appState.activeSpecialFilter) {
        const withData = appState.specialFilterIds[appState.activeSpecialFilter];
        for (const id of visibleIds) {
            if (!withData.has(id)) visibleIds.delete(id);
        }
    }

    APP_CONFIG.tabs.forEach(tab => {
        appState.filteredData[tab.key] = appState.allData[tab.key]
            .filter(row => visibleIds.has(row[LINK_FIELD]));
    });

    applyAllFilters(PRIMARY_TAB.key);
    updateAllDropdownOptions();
}


// ════════════════════════════════════════════════════════════════════════════
// TABLE HELPERS
// ════════════════════════════════════════════════════════════════════════════

function getNumericFields(data) {
    if (!data || data.length === 0) return new Set();

    const exclude = new Set([
        ...APP_CONFIG.hiddenColumns,
        ...(APP_CONFIG.nonNumericColumns || []),
        LINK_FIELD, LABEL_FIELD, GEOM_FIELD,
    ]);

    const sampleRows = data.slice(0, 20);
    const numericFields = new Set();

    for (const key of Object.keys(data[0]).filter(k => !exclude.has(k))) {
        const hasValue   = sampleRows.some(r => r[key] !== null && r[key] !== undefined && r[key] !== '');
        const allNumeric = sampleRows.every(r => {
            const v = r[key];
            if (v === null || v === undefined || v === '') return true;
            return typeof v === 'number' || (!isNaN(parseFloat(v)) && isFinite(v));
        });
        if (hasValue && allNumeric) numericFields.add(key);
    }
    return numericFields;
}

function shouldHideColumn(tableType, columnName) {
    if (APP_CONFIG.hiddenColumns.includes(columnName)) return true;
    // Hide the link field on non-primary tabs (implicit via the prepended label column)
    const tab = APP_CONFIG.tabs.find(t => t.key === tableType);
    if (!tab?.isPrimary && columnName === LINK_FIELD) return true;
    return false;
}

function isURL(value) {
    if (!value || typeof value !== 'string') return false;
    return value.startsWith('http://') || value.startsWith('https://') || value.startsWith('ftp://');
}

function getLinkLabel(columnKey) {
    return APP_CONFIG.urlFields?.[columnKey] || 'View';
}


// ════════════════════════════════════════════════════════════════════════════
// TABLE RENDERING
// ════════════════════════════════════════════════════════════════════════════

// ════════════════════════════════════════════════════════════════════════════
// DROPDOWN WIDGET
// ════════════════════════════════════════════════════════════════════════════

function closeAllDropdowns() {
    document.querySelectorAll('.dd-panel[data-open="true"]').forEach(panel => {
        panel.dataset.open = 'false';
        const btn = document.querySelector(
            `.dd-summary[data-tab="${panel.dataset.tab}"][data-col="${CSS.escape(panel.dataset.col)}"]`
        );
        if (btn) {
            btn.setAttribute('aria-expanded', 'false');
            btn.classList.remove('dd-open');
        }
    });
}

function updateDropdownSummary(btn, selected) {
    const count = selected.size;
    let label;
    if (count === 0)      label = 'All';
    else if (count <= 2)  label = [...selected].join(', ');
    else                  label = `${[...selected].slice(0, 2).join(', ')} +${count - 2}`;

    // Clear and rebuild so the caret span survives
    btn.textContent = '';
    const text = document.createElement('span');
    text.textContent = label;
    const caret = document.createElement('span');
    caret.className = 'dd-caret';
    caret.setAttribute('aria-hidden', 'true');
    caret.textContent = '▾';
    btn.appendChild(text);
    btn.appendChild(caret);
    btn.classList.toggle('dd-active', count > 0);
}

function renderDropdownOptions(panel, tableType, col, searchTerm) {
    const optList  = panel.querySelector('.dd-options');
    const selected = appState.dropdownState[tableType][col] || new Set();
    const options  = (appState.dropdownOptions[tableType][col] || [])
        .filter(v => !searchTerm || v.toLowerCase().includes(searchTerm));

    optList.innerHTML = '';

    if (options.length === 0) {
        const msg = document.createElement('div');
        msg.className   = 'dd-empty';
        msg.textContent = searchTerm ? 'No matching values' : 'No values available';
        optList.appendChild(msg);
        return;
    }

    options.forEach(val => {
        const label = document.createElement('label');
        label.className = 'dd-option';
        label.setAttribute('role', 'option');
        label.setAttribute('aria-selected', String(selected.has(val)));

        const cb = document.createElement('input');
        cb.type    = 'checkbox';
        cb.checked = selected.has(val);
        cb.addEventListener('change', e => {
            e.stopPropagation();
            if (cb.checked) selected.add(val);
            else            selected.delete(val);
            label.setAttribute('aria-selected', String(cb.checked));
            const btn = document.querySelector(
                `.dd-summary[data-tab="${tableType}"][data-col="${CSS.escape(col)}"]`
            );
            if (btn) updateDropdownSummary(btn, selected);
            applyAllFilters(tableType);
        });

        const text = document.createElement('span');
        text.textContent = val;

        label.appendChild(cb);
        label.appendChild(text);
        optList.appendChild(label);
    });
}

function refreshDropdownPanel(panel, tableType, col) {
    const searchEl   = panel.querySelector('.dd-search');
    const searchTerm = searchEl ? searchEl.value.toLowerCase() : '';
    renderDropdownOptions(panel, tableType, col, searchTerm);
}

function buildDropdownWidget(tableType, col) {
    // Ensure Set exists in state
    if (!appState.dropdownState[tableType][col]) {
        appState.dropdownState[tableType][col] = new Set();
    }
    const selected = appState.dropdownState[tableType][col];

    // ── Outer wrapper ─────────────────────────────────────────────────────
    const wrapper = document.createElement('div');
    wrapper.className = 'dd-wrapper';
    // Prevent clicks inside the widget from bubbling to the th sort handler
    wrapper.addEventListener('click', e => e.stopPropagation());

    // ── Summary button ────────────────────────────────────────────────────
    const btn = document.createElement('button');
    btn.type      = 'button';
    btn.className = 'dd-summary';
    btn.setAttribute('aria-haspopup', 'listbox');
    btn.setAttribute('aria-expanded', 'false');
    btn.setAttribute('aria-label', `Filter ${col}`);
    btn.dataset.tab = tableType;
    btn.dataset.col = col;
    updateDropdownSummary(btn, selected);

    // ── Floating panel ────────────────────────────────────────────────────
    const panel = document.createElement('div');
    panel.className    = 'dd-panel';
    panel.dataset.tab  = tableType;
    panel.dataset.col  = col;
    panel.dataset.open = 'false';
    panel.setAttribute('role', 'listbox');
    panel.setAttribute('aria-multiselectable', 'true');
    panel.setAttribute('aria-label', `${col} options`);

    // Search within panel
    const search = document.createElement('input');
    search.type        = 'text';
    search.className   = 'dd-search';
    search.placeholder = 'Search…';
    search.setAttribute('aria-label', `Search ${col} values`);
    search.addEventListener('input', () => {
        renderDropdownOptions(panel, tableType, col, search.value.toLowerCase());
    });

    // Select all / Clear controls
    const controls = document.createElement('div');
    controls.className = 'dd-controls';

    const selectAllBtn = document.createElement('button');
    selectAllBtn.type        = 'button';
    selectAllBtn.className   = 'dd-ctrl-btn';
    selectAllBtn.textContent = 'Select all';
    selectAllBtn.addEventListener('click', () => {
        (appState.dropdownOptions[tableType][col] || []).forEach(v => selected.add(v));
        refreshDropdownPanel(panel, tableType, col);
        updateDropdownSummary(btn, selected);
        applyAllFilters(tableType);
    });

    const clearBtn = document.createElement('button');
    clearBtn.type        = 'button';
    clearBtn.className   = 'dd-ctrl-btn';
    clearBtn.textContent = 'Clear';
    clearBtn.addEventListener('click', () => {
        selected.clear();
        refreshDropdownPanel(panel, tableType, col);
        updateDropdownSummary(btn, selected);
        applyAllFilters(tableType);
    });

    controls.appendChild(selectAllBtn);
    controls.appendChild(clearBtn);

    // Options list container
    const optList = document.createElement('div');
    optList.className = 'dd-options';

    panel.appendChild(search);
    panel.appendChild(controls);
    panel.appendChild(optList);
    wrapper.appendChild(btn);
    wrapper.appendChild(panel);

    // ── Open / close ──────────────────────────────────────────────────────
    btn.addEventListener('click', () => {
        const isOpen = panel.dataset.open === 'true';
        closeAllDropdowns();
        if (!isOpen) {
            panel.dataset.open = 'true';
            btn.setAttribute('aria-expanded', 'true');
            btn.classList.add('dd-open');
            // Position below the button
            const rect = btn.getBoundingClientRect();
            panel.style.top      = (rect.bottom + 2) + 'px';
            panel.style.left     = rect.left + 'px';
            panel.style.minWidth = Math.max(rect.width, 200) + 'px';
            refreshDropdownPanel(panel, tableType, col);
            search.value = '';
            setTimeout(() => search.focus(), 0);
        }
    });

    panel.addEventListener('keydown', e => {
        if (e.key === 'Escape') { closeAllDropdowns(); btn.focus(); }
    });

    return wrapper;
}

function renderTableHeader(tableType) {
    if (appState._headerBuilt[tableType]) return;
    appState._headerBuilt[tableType] = true;

    const data = appState.allData[tableType];
    if (!data || data.length === 0) return;

    const headerRow = document.getElementById(`${tableType}-header`);
    headerRow.innerHTML = '';

    for (const key of Object.keys(data[0])) {
        if (shouldHideColumn(tableType, key)) continue;

        const th = document.createElement('th');
        const thContent = document.createElement('div');
        thContent.className = 'th-content';

        const label = document.createElement('span');
        label.textContent = key;

        const isRangeCol    = Object.prototype.hasOwnProperty.call(APP_CONFIG.rangeFilterColumns || {}, key);
        const isDropdownCol = (APP_CONFIG.dropdownColumns || []).includes(key);
        let filterWidget;

        const inputId = `filter-${tableType}-${key.replace(/\s+/g, '-')}`;

        if (isDropdownCol) {
            filterWidget = buildDropdownWidget(tableType, key);
            // Sort on click of the th label area only (widget stops propagation internally)
            th.addEventListener('click', () => toggleSort(tableType, key));

        } else if (isRangeCol) {
            // Default operator comes from APP_CONFIG; can be toggled by the user.
            // The live operator is stored in rangeState so it survives filter cycles.
            const defaultOp = APP_CONFIG.rangeFilterColumns[key];
            // Per-column operator: stored separately from rangeState so it
            // survives Clear All (which resets values but not operators).
            appState._rangeOperator ??= {};
            appState._rangeOperator[tableType] ??= {};
            appState._rangeOperator[tableType][key] ??= defaultOp;

            const wrapper  = document.createElement('div');
            wrapper.className = 'range-filter-wrapper';

            const badge = document.createElement('button');
            badge.type      = 'button';
            badge.className = 'range-operator range-operator-btn';
            const currentOp = () => appState._rangeOperator[tableType][key];
            const updateBadge = () => {
                badge.textContent = currentOp() === 'gte' ? '≥' : '≤';
                badge.title       = currentOp() === 'gte'
                    ? 'Minimum — click to switch to maximum (≤)'
                    : 'Maximum — click to switch to minimum (≥)';
                badge.setAttribute('aria-label',
                    currentOp() === 'gte' ? 'Switch to ≤ (maximum)' : 'Switch to ≥ (minimum)');
            };
            updateBadge();

            const rangeInput = document.createElement('input');
            rangeInput.type        = 'number';
            rangeInput.id          = inputId;
            rangeInput.className   = 'column-search range-input';
            rangeInput.placeholder = '0';
            rangeInput.dataset.column = key;
            rangeInput.dataset.table  = tableType;
            rangeInput.value = appState.rangeState[tableType][key]?.value ?? '';
            rangeInput.setAttribute('aria-label',
                `Filter ${key} (${currentOp() === 'gte' ? 'minimum' : 'maximum'})`);

            const triggerFilter = () => {
                const val = rangeInput.value.trim();
                if (val === '') {
                    delete appState.rangeState[tableType][key];
                } else {
                    appState.rangeState[tableType][key] = {
                        value: parseFloat(val),
                        operator: currentOp(),
                    };
                }
                clearTimeout(appState._filterDebounce);
                appState._filterDebounce = setTimeout(() => applyAllFilters(tableType), 180);
            };

            rangeInput.addEventListener('input', triggerFilter);

            badge.addEventListener('click', e => {
                e.stopPropagation();
                // Toggle operator
                appState._rangeOperator[tableType][key] =
                    currentOp() === 'gte' ? 'lte' : 'gte';
                updateBadge();
                rangeInput.setAttribute('aria-label',
                    `Filter ${key} (${currentOp() === 'gte' ? 'minimum' : 'maximum'})`);
                // Re-apply filter with new operator if a value is set
                if (rangeInput.value.trim() !== '') triggerFilter();
            });

            wrapper.appendChild(badge);
            wrapper.appendChild(rangeInput);
            filterWidget = wrapper;
            th.addEventListener('click', e => {
                if (rangeInput.contains(e.target) || badge.contains(e.target)) return;
                toggleSort(tableType, key);
            });

        } else {
            const searchInput = document.createElement('input');
            searchInput.type      = 'text';
            searchInput.id        = inputId;
            searchInput.className = 'column-search';
            searchInput.placeholder = 'Filter...';
            searchInput.setAttribute('aria-label', `Filter ${key}`);
            searchInput.dataset.column = key;
            searchInput.dataset.table  = tableType;
            searchInput.value = appState.searchState[tableType][key] || '';

            searchInput.addEventListener('input', e => {
                appState.searchState[tableType][key] = e.target.value.toLowerCase();
                clearTimeout(appState._filterDebounce);
                appState._filterDebounce = setTimeout(() => applyAllFilters(tableType), 180);
            });

            filterWidget = searchInput;
            th.addEventListener('click', e => {
                if (searchInput.contains(e.target)) return;
                toggleSort(tableType, key);
            });
        }

        th.setAttribute('scope', 'col');
        th.setAttribute('aria-sort', 'none');
        thContent.appendChild(label);
        thContent.appendChild(filterWidget);
        th.appendChild(thContent);
        th.style.cursor = 'pointer';
        th.style.userSelect = 'none';
        th.title = 'Click to sort';
        headerRow.appendChild(th);
    }
}

// ── Virtual table ─────────────────────────────────────────────────────────
// Row height is read once from the CSS custom property so JS and CSS stay
// in sync — change --row-height in app.css and virtual scrolling adapts.
const ROW_HEIGHT = parseInt(
    getComputedStyle(document.documentElement).getPropertyValue('--row-height')
) || 41;
const VIRTUAL_BUFFER = 10; // extra rows rendered above and below the viewport

function buildTableRow(tableType, row, numericFields) {
    const tr     = document.createElement('tr');
    const linkId = row[LINK_FIELD];
    const cached = appState.geomCache.get(linkId);

    for (const [key, value] of Object.entries(row)) {
        if (shouldHideColumn(tableType, key)) continue;

        const td = document.createElement('td');

        if (isURL(value)) {
            const link = document.createElement('a');
            link.href = value;
            link.textContent = getLinkLabel(key);
            link.target = '_blank';
            link.className = 'data-link';
            td.appendChild(link);
        } else if (numericFields.has(key)) {
            td.className = 'numeric';
            if (value !== null && value !== undefined) {
                const num = parseFloat(value);
                td.textContent = isNaN(num) ? value : num.toFixed(2);
            } else {
                td.textContent = '—';
            }
        } else {
            td.textContent = value || '—';
        }

        // Show full value on hover — useful when truncateCells clips long text
        if (value !== null && value !== undefined && value !== '') {
            td.title = String(value);
        }

        const computedLink = COMPUTED_LINK_MAP[key];
        if (computedLink && value !== null && value !== undefined && value !== '') {
            const iconLink = document.createElement('a');
            iconLink.href      = computedLink.prefix + encodeURIComponent(value) + computedLink.suffix ;
            iconLink.target    = '_blank';
            iconLink.className = 'computed-link-icon';
            if (computedLink.title) iconLink.title = computedLink.title;
            const icon = document.createElement('i');
            icon.className = `fas ${computedLink.icon || 'fa-external-link-alt'}`;
            iconLink.appendChild(icon);
            td.appendChild(iconLink);
        }

        // Deployment link icons — one per matching deploymentlinks.json entry
        appendDeploymentLinkIcons(td, tableType, key, value);

        if (key === LABEL_FIELD && cached) {
            const zoomBtn = document.createElement('button');
            zoomBtn.className = 'zoom-icon';
            zoomBtn.setAttribute('aria-label', `Zoom to ${row[LABEL_FIELD] || linkId}`);
            zoomBtn.title = cached.type === 'polygon' ? 'Zoom to feature' : 'Zoom to site';
            zoomBtn.innerHTML = '<i class="fas fa-search-location" aria-hidden="true"></i>';
            zoomBtn.addEventListener('click', () => window.__zoomToId(linkId));
            td.appendChild(zoomBtn);
        }

        tr.appendChild(td);
    }
    return tr;
}

function renderVirtualSlice(tableType) {
    const rows       = appState.virtualRows[tableType];
    const wrapper    = document.getElementById(`${tableType}-wrapper`);
    const tbody      = document.getElementById(`${tableType}-body`);
    const spacerTop  = document.getElementById(`${tableType}-spacer-top`);
    const spacerBot  = document.getElementById(`${tableType}-spacer-bottom`);
    if (!rows || !wrapper || !spacerTop || !spacerBot) return;

    const scrollTop  = wrapper.scrollTop;
    const viewHeight = wrapper.clientHeight || 400;
    const total      = rows.length;

    const firstIdx = Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - VIRTUAL_BUFFER);
    const lastIdx  = Math.min(total, Math.ceil((scrollTop + viewHeight) / ROW_HEIGHT) + VIRTUAL_BUFFER);

    // Size spacers so the scrollbar reflects the full dataset height
    spacerTop.style.height = `${firstIdx * ROW_HEIGHT}px`;
    spacerBot.style.height = `${Math.max(0, (total - lastIdx) * ROW_HEIGHT)}px`;

    const numericFields = appState.numericFieldCache[tableType] || new Set();
    const fragment = document.createDocumentFragment();
    rows.slice(firstIdx, lastIdx).forEach(row => {
        fragment.appendChild(buildTableRow(tableType, row, numericFields));
    });

    // Remove previously rendered rows, leaving the two spacers in place
    while (tbody.children.length > 2) {
        tbody.removeChild(tbody.children[1]);
    }
    // Insert rendered rows between the two spacers
    tbody.insertBefore(fragment, spacerBot);
}

function renderTableBody(tableType, data) {
    const tbody      = document.getElementById(`${tableType}-body`);
    const emptyMsg   = document.getElementById(`${tableType}-empty`);
    const table      = document.getElementById(`${tableType}-table`);
    const spacerTop  = document.getElementById(`${tableType}-spacer-top`);
    const spacerBot  = document.getElementById(`${tableType}-spacer-bottom`);

    // Update the count badge on the tab button
    const countEl = document.getElementById(`tab-count-${tableType}`);
    if (countEl) countEl.textContent = data.length > 0 ? `(${data.length})` : '';

    if (data.length === 0) {
        emptyMsg.className     = 'no-data'; // remove loading class if present
        emptyMsg.style.color   = '';
        emptyMsg.textContent   = 'No data to display';
        emptyMsg.style.display = 'block';
        tbody.style.display    = 'none';
        table.style.display    = 'table';
        if (spacerTop) spacerTop.style.height = '0';
        if (spacerBot) spacerBot.style.height = '0';
        while (tbody.children.length > 2) tbody.removeChild(tbody.children[1]);
        appState.virtualRows[tableType] = [];
        return;
    }

    emptyMsg.className     = 'no-data'; // remove loading class if present
    emptyMsg.style.color   = '';
    emptyMsg.style.display = 'none';
    tbody.style.display    = 'table-row-group';
    table.style.display    = 'table';

    appState.virtualRows[tableType] = data;

    const wrapper = document.getElementById(`${tableType}-wrapper`);
    if (wrapper) wrapper.scrollTop = 0;

    renderVirtualSlice(tableType);
}

function renderTable(tableType) {
    renderTableHeader(tableType);
    let rows = [...appState.filteredData[tableType]];
    rows = applyColumnFilters(rows, tableType);
    rows = applySort(rows, tableType);
    renderTableBody(tableType, rows);
}


// ════════════════════════════════════════════════════════════════════════════
// FILTERING & SORTING
// ════════════════════════════════════════════════════════════════════════════

function applyColumnFilters(rows, tableType) {
    // Text search — case-insensitive substring
    for (const [col, term] of Object.entries(appState.searchState[tableType])) {
        if (term) {
            rows = rows.filter(row => {
                const v = row[col];
                return (v === null || v === undefined ? '' : String(v).toLowerCase()).includes(term);
            });
        }
    }
    // Numeric range
    for (const [col, rule] of Object.entries(appState.rangeState[tableType])) {
        if (!isNaN(rule.value)) {
            rows = rows.filter(row => {
                const n = parseFloat(row[col]);
                if (isNaN(n)) return false;
                return rule.operator === 'gte' ? n >= rule.value : n <= rule.value;
            });
        }
    }
    // Dropdown multi-select — OR within column, AND across columns
    for (const [col, selected] of Object.entries(appState.dropdownState[tableType] || {})) {
        if (selected && selected.size > 0) {
            rows = rows.filter(row => {
                const v = (row[col] === null || row[col] === undefined) ? '' : String(row[col]);
                return selected.has(v);
            });
        }
    }
    return rows;
}

function applySort(rows, tableType) {
    const s = appState.sortState[tableType];
    if (!s.column) return rows;

    const numFields = appState.numericFieldCache[tableType] || getNumericFields(appState.filteredData[tableType]);
    const isNum     = numFields.has(s.column);

    return [...rows].sort((a, b) => {
        let av = a[s.column], bv = b[s.column];
        if (av === null || av === undefined) av = isNum ? -Infinity : '';
        if (bv === null || bv === undefined) bv = isNum ? -Infinity : '';

        const cmp = isNum
            ? parseFloat(av) - parseFloat(bv)
            : String(av).toLowerCase().localeCompare(String(bv).toLowerCase());

        return s.direction === 'asc' ? cmp : -cmp;
    });
}

function toggleSort(tableType, column) {
    const s = appState.sortState[tableType];
    s.direction = (s.column === column && s.direction === 'asc') ? 'desc' : 'asc';
    s.column = column;

    // Update aria-sort on all headers for this table
    const headerRow = document.getElementById(`${tableType}-header`);
    if (headerRow) {
        headerRow.querySelectorAll('th').forEach(th => {
            const span = th.querySelector('.th-content > span');
            if (!span) return;
            // Strip any existing sort indicator
            span.textContent = span.textContent.replace(/ [▲▼]$/, '');
            if (span.textContent === column) {
                th.setAttribute('aria-sort', s.direction === 'asc' ? 'ascending' : 'descending');
                span.textContent += s.direction === 'asc' ? ' ▲' : ' ▼';
            } else {
                th.setAttribute('aria-sort', 'none');
            }
        });
    }

    applyAllFilters(tableType);
}

// ════════════════════════════════════════════════════════════════════════════
// ACTIVE FILTER DISPLAY
// ════════════════════════════════════════════════════════════════════════════

function renderActiveFilters() {
    const container = document.getElementById('active-filters');
    if (!container) return;
    container.innerHTML = '';

    const pills = [];

    // ── Special filter ────────────────────────────────────────────────────
    if (appState.activeSpecialFilter) {
        const tab = APP_CONFIG.tabs.find(t => t.key === appState.activeSpecialFilter);
        pills.push({
            label: tab?.specialFilter || appState.activeSpecialFilter,
            clear() {
                appState.activeSpecialFilter = null;
                updateDataFiltersBtn();
                applyBoundsFilter();
            }
        });
    }

    // ── Text search filters ───────────────────────────────────────────────
    APP_CONFIG.tabs.forEach(tab => {
        Object.entries(appState.searchState[tab.key] || {}).forEach(([col, val]) => {
            if (!val) return;
            pills.push({
                label: `${tab.label}: ${col} = "${val}"`,
                clear() {
                    appState.searchState[tab.key][col] = '';
                    const input = document.querySelector(
                        `input[data-table="${tab.key}"][data-column="${col}"]`
                    );
                    if (input) input.value = '';
                    applyAllFilters(tab.key);
                }
            });
        });
    });

    // ── Range filters ─────────────────────────────────────────────────────
    APP_CONFIG.tabs.forEach(tab => {
        Object.entries(appState.rangeState[tab.key] || {}).forEach(([col, state]) => {
            const op = state.operator === 'gte' ? '≥' : '≤';
            pills.push({
                label: `${tab.label}: ${col} ${op} ${state.value}`,
                clear() {
                    delete appState.rangeState[tab.key][col];
                    const input = document.querySelector(
                        `input[data-table="${tab.key}"][data-column="${col}"]`
                    );
                    if (input) input.value = '';
                    applyAllFilters(tab.key);
                }
            });
        });
    });

    // ── Dropdown filters — one pill per column showing all selected values ─
    APP_CONFIG.tabs.forEach(tab => {
        Object.entries(appState.dropdownState[tab.key] || {}).forEach(([col, selected]) => {
            if (!selected || selected.size === 0) return;
            const values = [...selected].join(', ');
            pills.push({
                label: `${tab.label}: ${col} = ${values}`,
                clear() {
                    appState.dropdownState[tab.key][col] = new Set();
                    // Update the summary button if the widget is in the DOM
                    const btn = document.querySelector(
                        `.dd-summary[data-tab="${tab.key}"][data-col="${CSS.escape(col)}"]`
                    );
                    if (btn) updateDropdownSummary(btn, appState.dropdownState[tab.key][col]);
                    applyAllFilters(tab.key);
                }
            });
        });
    });

    pills.forEach(pill => {
        const el  = document.createElement('span');
        el.className   = 'filter-pill';
        el.textContent = pill.label;

        const btn = document.createElement('button');
        btn.className = 'filter-pill-clear';
        btn.setAttribute('aria-label', `Clear filter: ${pill.label}`);
        btn.textContent = '×';
        btn.addEventListener('click', () => pill.clear());

        el.appendChild(btn);
        container.appendChild(el);
    });
}


// ════════════════════════════════════════════════════════════════════════════
// DROPDOWN OPTION COMPUTATION
// Derives the set of available values for one dropdown column given the
// current filter state, deliberately excluding that column's own selection
// so users can always change their choice.
// ════════════════════════════════════════════════════════════════════════════

function computeDropdownOptions(tableType, targetCol) {
    // Start from the bounds snapshot for this tab, scoped to the fully-resolved
    // intersectedIds so that other sibling tab filters are reflected in the
    // available options — not just primary tab column filters.
    const isPrimary = APP_CONFIG.tabs.find(t => t.key === tableType)?.isPrimary;

    let rows = [...appState.filteredData[tableType]];

    if (!isPrimary) {
        // Re-derive intersectedIds the same way updateMapAndTables does:
        // start from primary-column-filtered IDs, then narrow by every sibling
        // tab that has active filters (excluding targetCol's own tab to avoid
        // removing options the user hasn't finished selecting).
        const primaryFiltered = applyColumnFilters(
            [...appState.filteredData[PRIMARY_TAB.key]], PRIMARY_TAB.key
        );
        let intersectedIds = new Set(primaryFiltered.map(r => r[LINK_FIELD]).filter(Boolean));

        APP_CONFIG.tabs.forEach(tab => {
            if (tab.isPrimary || tab.key === tableType) return;
            if (!hasTabActiveFilters(tab.key)) return;
            const siblingRows  = appState.filteredData[tab.key]
                .filter(r => intersectedIds.has(r[LINK_FIELD]));
            const filteredRows = applyColumnFilters(siblingRows, tab.key);
            const siblingIds   = new Set(filteredRows.map(r => r[LINK_FIELD]).filter(Boolean));
            intersectedIds = intersect(intersectedIds, siblingIds);
        });

        rows = rows.filter(r => intersectedIds.has(r[LINK_FIELD]));
    }

    // Apply this tab's own text filters
    for (const [col, term] of Object.entries(appState.searchState[tableType])) {
        if (term) rows = rows.filter(row => {
            const v = row[col];
            return (v === null || v === undefined ? '' : String(v).toLowerCase()).includes(term);
        });
    }
    // Apply this tab's own range filters
    for (const [col, rule] of Object.entries(appState.rangeState[tableType])) {
        if (!isNaN(rule.value)) rows = rows.filter(row => {
            const n = parseFloat(row[col]);
            if (isNaN(n)) return false;
            return rule.operator === 'gte' ? n >= rule.value : n <= rule.value;
        });
    }
    // Apply all OTHER dropdown filters on this tab (skip targetCol so its options stay live)
    for (const [col, selected] of Object.entries(appState.dropdownState[tableType] || {})) {
        if (col === targetCol || !selected || selected.size === 0) continue;
        rows = rows.filter(row => {
            const v = (row[col] === null || row[col] === undefined) ? '' : String(row[col]);
            return selected.has(v);
        });
    }

    const seen = new Set();
    rows.forEach(row => {
        const v = row[targetCol];
        if (v !== null && v !== undefined && v !== '') seen.add(String(v));
    });
    return [...seen].sort((a, b) =>
        a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' })
    );
}

// Recompute and cache options for every dropdown column on every tab.
// Called after every filter change (including bounds change).
function updateAllDropdownOptions() {
    const cols = APP_CONFIG.dropdownColumns || [];
    if (cols.length === 0) return;
    APP_CONFIG.tabs.forEach(tab => {
        cols.forEach(col => {
            appState.dropdownOptions[tab.key][col] = computeDropdownOptions(tab.key, col);
        });
    });
    // Refresh any panels that are currently open
    document.querySelectorAll('.dd-panel[data-open="true"]').forEach(panel => {
        refreshDropdownPanel(panel, panel.dataset.tab, panel.dataset.col);
    });
}



// ════════════════════════════════════════════════════════════════════════════

function applyAllFilters(tableType) {
    const isPrimary = APP_CONFIG.tabs.find(t => t.key === tableType)?.isPrimary;

    // Always compute the primary column-filtered set first — this is the
    // authoritative scope for all sibling tables and for marker rendering.
    // Using filteredData (the bounds snapshot) as the starting point means
    // geographic scope and column filters are cleanly separated.
    const primaryBase = applySort(
        applyColumnFilters([...appState.filteredData[PRIMARY_TAB.key]], PRIMARY_TAB.key),
        PRIMARY_TAB.key
    );
    const primaryIds = new Set(primaryBase.map(r => r[LINK_FIELD]).filter(Boolean));

    let baseFiltered;
    if (isPrimary) {
        // Primary tab triggered — primaryBase is already the filtered result.
        baseFiltered = primaryBase;
    } else {
        // Sibling tab triggered — scope to the bounds snapshot for this tab,
        // then narrow to IDs that pass primary column filters.
        // Using filteredData (bounds snapshot) keeps geographic scope intact
        // and prevents showing out-of-bounds rows during rapid filter changes.
        baseFiltered = appState.filteredData[tableType].filter(
            item => primaryIds.has(item[LINK_FIELD])
        );
    }

    // For sibling tabs, don't render here — updateMapAndTables Pass 2 renders
    // all siblings from the fully-resolved intersectedIds (which includes
    // narrowing by all other active sibling filters). Rendering early here
    // would show results narrowed only by primaryIds, missing other siblings.
    if (isPrimary) {
        renderTableBody(tableType, applySort(applyColumnFilters([...baseFiltered], tableType), tableType));
    }
    updateMapAndTables(tableType, primaryBase, primaryIds);
    renderActiveFilters();
    updateAllDropdownOptions();
}


function intersect(a, b) { return new Set([...a].filter(id => b.has(id))); }

function hasTabActiveFilters(tabKey) {
    return (
        Object.values(appState.searchState[tabKey]).some(v => v) ||
        Object.keys(appState.rangeState[tabKey]).length > 0 ||
        Object.values(appState.dropdownState[tabKey] || {}).some(s => s?.size > 0)
    );
}

function updateMapAndTables(sourceTableType, primaryBase, primaryIds) {
    const boundsData = appState.filteredData;

    // ── Pass 1: compute the fully-narrowed intersectedIds ─────────────────
    // Start from the full primary-filtered set. Every sibling with active
    // filters narrows this. We must compute the final set before rendering
    // any table, otherwise siblings that appear before the triggering tab in
    // tab order get rendered from a wider (not yet narrowed) set.
    let intersectedIds = new Set(primaryIds);

    APP_CONFIG.tabs.forEach(tab => {
        if (tab.isPrimary) return;

        if (hasTabActiveFilters(tab.key)) {
            const scopedRows  = boundsData[tab.key].filter(r => intersectedIds.has(r[LINK_FIELD]));
            const filteredRows = applyColumnFilters(scopedRows, tab.key);
            const siblingIds  = new Set(filteredRows.map(r => r[LINK_FIELD]).filter(Boolean));
            intersectedIds = intersect(intersectedIds, siblingIds);
        }
    });

    // ── Pass 2: render all sibling tables from the final intersectedIds ───
    APP_CONFIG.tabs.forEach(tab => {
        if (tab.isPrimary) return;

        const siblingRows = applySort(
            applyColumnFilters(
                boundsData[tab.key].filter(r => intersectedIds.has(r[LINK_FIELD])),
                tab.key
            ),
            tab.key
        );
        renderTableBody(tab.key, siblingRows);
    });

    // Re-render the primary table filtered to the fully-resolved intersectedIds.
    // This must happen after the sibling loop so sibling filters are reflected.
    // We always filter to intersectedIds regardless of which tab triggered —
    // using primaryBase unfiltered would show locations that pass primary column
    // filters but fail sibling filters, which contradicts what the map shows.
    const primaryFiltered = primaryBase.filter(row => intersectedIds.has(row[LINK_FIELD]));
    APP_CONFIG.tabs.filter(t => t.isPrimary).forEach(t => {
        renderTableBody(t.key, primaryFiltered);
    });

    // Rebuild map layers from the fully intersected ID set.
    clearLayers();
    const layers = [];
    primaryBase
        .filter(row => intersectedIds.has(row[LINK_FIELD]))
        .forEach(row => {
            const layer = createLayer(row);
            if (layer) layers.push(layer);
        });
    addLayers(layers);
    updateLayerCount();
}


// ════════════════════════════════════════════════════════════════════════════
// EXPORT TO EXCEL
// ════════════════════════════════════════════════════════════════════════════

function getDisplayDataForTab(tableType, modeOverride) {
    const activeIds = new Set(appState.layers.map(m => m.featureId));
    const tab = APP_CONFIG.tabs.find(t => t.key === tableType);

    let rows = appState.allData[tableType].filter(item => activeIds.has(item[LINK_FIELD]));

    // modeOverride from the export dropdown takes precedence over per-tab config.
    // exportRows: 'all'      — all rows for active boreholes
    // exportRows: 'filtered' — only rows matching active column filters
    // Primary tab always exports filtered rows since its filters define which
    // boreholes are active in the first place.
    const exportRows = modeOverride ?? tab?.exportRows ?? (tab?.isPrimary ? 'filtered' : 'all');
    if (exportRows === 'filtered') {
        rows = applyColumnFilters(rows, tableType);
    }

    return rows.map(row => {
        const clean = { ...row };
        APP_CONFIG.hiddenColumns.forEach(col => delete clean[col]);
        return clean;
    });
}

// mode: 'all'      — all rows for active boreholes on every sibling tab
//       'filtered' — only rows matching active column filters on each tab
//       undefined  — use per-tab exportRows config value (default)
function exportToExcel(mode) {
    const btn = document.getElementById('export-btn');
    btn.disabled = true;
    btn.textContent = 'Exporting…';

    try {
        const wb = XLSX.utils.book_new();

        APP_CONFIG.tabs.forEach(tab => {
            const data = getDisplayDataForTab(tab.key, mode);
            if (data.length === 0) {
                XLSX.utils.book_append_sheet(
                    wb,
                    XLSX.utils.aoa_to_sheet([['No data to display for current filters']]),
                    tab.label
                );
                return;
            }
            const ws   = XLSX.utils.json_to_sheet(data);
            const cols = Object.keys(data[0]);
            ws['!cols'] = cols.map(col => ({
                wch: Math.min(
                    data.reduce((max, row) => {
                        const v = row[col];
                        return Math.max(max, v === null || v === undefined ? 0 : String(v).length);
                    }, col.length) + 2,
                    50
                ),
            }));
            XLSX.utils.book_append_sheet(wb, ws, tab.label);
        });

        const now = new Date();
        const ts  = now.getFullYear()
            + String(now.getMonth() + 1).padStart(2, '0')
            + String(now.getDate()).padStart(2, '0') + '_'
            + String(now.getHours()).padStart(2, '0')
            + String(now.getMinutes()).padStart(2, '0')
            + String(now.getSeconds()).padStart(2, '0');

        XLSX.writeFile(wb, `${APP_CONFIG.title.replace(/\s+/g, '_')}_${ts}.xlsx`);
    } catch (err) {
        console.error('Export failed:', err);
        alert('Export failed: ' + err.message);
    } finally {
        btn.disabled = false;
        btn.innerHTML = '&#8681; Export &#9662;';
    }
}


// ════════════════════════════════════════════════════════════════════════════
// CLEAR ALL FILTERS — shared by the Clear All button and Zoom to All
// ════════════════════════════════════════════════════════════════════════════

function clearAllFilters() {
    document.querySelectorAll('.column-search').forEach(i => i.value = '');
    APP_CONFIG.tabs.forEach(tab => {
        appState.searchState[tab.key] = {};
        appState.rangeState[tab.key]  = {};
        appState.sortState[tab.key]   = {};
        // Clear each Set in place — widget closures hold references to these objects
        Object.values(appState.dropdownState[tab.key] || {}).forEach(s => s?.clear());
        // Reset range operators to their APP_CONFIG defaults
        if (appState._rangeOperator?.[tab.key]) {
            Object.keys(appState._rangeOperator[tab.key]).forEach(col => {
                appState._rangeOperator[tab.key][col] = APP_CONFIG.rangeFilterColumns[col];
            });
        }
    });
    // Update any visible operator badges
    document.querySelectorAll('.range-operator-btn').forEach(btn => {
        const col    = btn.parentElement?.querySelector('.range-input')?.dataset?.column;
        const tabKey = btn.parentElement?.querySelector('.range-input')?.dataset?.table;
        if (!col || !tabKey) return;
        const op = appState._rangeOperator?.[tabKey]?.[col] || 'gte';
        btn.textContent = op === 'gte' ? '≥' : '≤';
        btn.title = op === 'gte'
            ? 'Minimum — click to switch to maximum (≤)'
            : 'Maximum — click to switch to minimum (≥)';
    });
    closeAllDropdowns();
    document.querySelectorAll('.dd-summary').forEach(btn => {
        const { tab: tabKey, col } = btn.dataset;
        if (tabKey && col) updateDropdownSummary(btn, appState.dropdownState[tabKey]?.[col] || new Set());
    });
    appState.activeSpecialFilter = null;
    updateDataFiltersBtn();
}


// ════════════════════════════════════════════════════════════════════════════
// ZOOM TO ALL EXTENTS
// ════════════════════════════════════════════════════════════════════════════

function zoomToAllExtents() {
    clearAllFilters();

    // Collect all cached geometry bounds for fitBounds
    const allLatLngs = [];
    appState.geomCache.forEach(cached => {
        if (cached.type === 'point') {
            allLatLngs.push(cached.latLng);
        } else if (cached.type === 'polygon') {
            allLatLngs.push(cached.bounds.getNorthEast());
            allLatLngs.push(cached.bounds.getSouthWest());
        }
    });
    if (allLatLngs.length === 0) return;
    map.fitBounds(L.latLngBounds(allLatLngs), { padding: [20, 20] });
}


// ════════════════════════════════════════════════════════════════════════════
// EVENT WIRING
// Called after buildUI() so all elements exist in the DOM.
// ════════════════════════════════════════════════════════════════════════════

function wireEvents() {

    // Tab switching — re-render virtual slice on newly visible tab since
    // clientHeight was 0 while the pane was hidden
    document.querySelectorAll('.tab-button').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.tab-button').forEach(b => {
                b.classList.remove('active');
                b.setAttribute('aria-selected', 'false');
            });
            document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
            btn.classList.add('active');
            btn.setAttribute('aria-selected', 'true');
            document.querySelector(`.tab-pane[data-tab="${btn.dataset.tab}"]`).classList.add('active');
            renderVirtualSlice(btn.dataset.tab);
        });
    });

    // Scroll listeners — RAF-throttled virtual re-render per tab
    APP_CONFIG.tabs.forEach(tab => {
        const wrapper = document.getElementById(`${tab.key}-wrapper`);
        if (!wrapper) return;
        appState._rafPending[tab.key] = false;
        wrapper.addEventListener('scroll', () => {
            if (appState._rafPending[tab.key]) return;
            appState._rafPending[tab.key] = true;
            requestAnimationFrame(() => {
                renderVirtualSlice(tab.key);
                appState._rafPending[tab.key] = false;
            });
        });
    });

    // Copy Link button — encodes current filter state into URL hash on demand
    document.getElementById('copy-link-btn').addEventListener('click', () => {
        const btn = document.getElementById('copy-link-btn');
        pushStateToUrl();  // encode current state into hash right now
        navigator.clipboard.writeText(window.location.href).then(() => {
            btn.innerHTML = '&#10003; Copied!';
            setTimeout(() => { btn.innerHTML = '&#128279; Copy Link'; }, 2000);
        }).catch(() => {
            prompt('Copy this link:', window.location.href);
        });
    });

    // Clear all filters
    document.getElementById('clear-filters-btn').addEventListener('click', () => {
        clearAllFilters();
        history.replaceState(null, '', window.location.pathname + window.location.search);
        applyBoundsFilter();
    });

    // ── Data Filters dropdown ────────────────────────────────────────────
    const dfBtn  = document.getElementById('data-filters-btn');
    const dfMenu = document.getElementById('data-filters-menu');

    if (dfBtn && dfMenu) {
        // Toggle menu
        dfBtn.addEventListener('click', e => {
            e.stopPropagation();
            const open = dfMenu.classList.toggle('open');
            dfBtn.querySelector('.btn-chevron').innerHTML = open ? '&#9652;' : '&#9662;';
        });

        // Close on outside click / Escape
        document.addEventListener('click', () => {
            dfMenu.classList.remove('open');
            if (dfBtn) dfBtn.querySelector('.btn-chevron').innerHTML = '&#9662;';
        });

        // Prevent menu clicks propagating to document listener
        dfMenu.addEventListener('click', e => e.stopPropagation());

        // Special filter item clicks
        APP_CONFIG.tabs.filter(t => t.specialFilter).forEach(tab => {
            document.getElementById(`special-filter-${tab.key}`)
                ?.addEventListener('click', () => {
                    // Toggle — clicking active filter deactivates it
                    appState.activeSpecialFilter =
                        appState.activeSpecialFilter === tab.key ? null : tab.key;
                    dfMenu.classList.remove('open');
                    dfBtn.querySelector('.btn-chevron').innerHTML = '&#9662;';
                    updateDataFiltersBtn();
                    applyBoundsFilter();
                });
        });
    }

    // ── Tabs manager dropdown ─────────────────────────────────────────────
    const tabsMgrBtn  = document.getElementById('tabs-manager-btn');
    const tabsMgrMenu = document.getElementById('tabs-manager-menu');

    if (tabsMgrBtn && tabsMgrMenu) {
        tabsMgrBtn.addEventListener('click', e => {
            e.stopPropagation();
            const open = tabsMgrMenu.classList.toggle('open');
            tabsMgrBtn.querySelector('.btn-chevron').innerHTML = open ? '&#9652;' : '&#9662;';
        });

        document.addEventListener('click', () => {
            tabsMgrMenu.classList.remove('open');
            if (tabsMgrBtn) tabsMgrBtn.querySelector('.btn-chevron').innerHTML = '&#9662;';
        });

        tabsMgrMenu.addEventListener('click', e => e.stopPropagation());

        document.querySelectorAll('.tabs-manager-item').forEach(item => {
            item.addEventListener('click', () => {
                const key = item.dataset.tabKey;
                if (appState.hiddenTabs.has(key)) {
                    appState.hiddenTabs.delete(key);
                } else {
                    appState.hiddenTabs.add(key);
                }
                applyTabVisibility();
            });
        });
    }

    // Zoom to extents
    document.getElementById('zoom-extents-btn').addEventListener('click', zoomToAllExtents);

    // Export dropdown
    const exportBtn      = document.getElementById('export-btn');
    const exportDropdown = document.getElementById('export-dropdown');

    // Toggle dropdown on main button click
    exportBtn.addEventListener('click', () => {
        exportDropdown.classList.toggle('open');
    });

    // Close dropdown if user clicks outside
    document.addEventListener('click', e => {
        if (!exportBtn.closest('.export-wrapper').contains(e.target)) {
            exportDropdown.classList.remove('open');
        }
        if (!e.target.closest('.dd-wrapper')) {
            closeAllDropdowns();
        }
    });

    document.getElementById('export-all-btn').addEventListener('click', () => {
        exportDropdown.classList.remove('open');
        exportToExcel('all');
    });

    document.getElementById('export-filtered-btn').addEventListener('click', () => {
        exportDropdown.classList.remove('open');
        exportToExcel('filtered');
    });

    // Close any open help popup when clicking anywhere outside a trigger
    document.addEventListener('click', () => {
        document.querySelectorAll('.tab-help-trigger.open').forEach(t => t.classList.remove('open'));
    });

    // Close on Escape globally
    document.addEventListener('keydown', e => {
        if (e.key === 'Escape') {
            document.querySelectorAll('.tab-help-trigger.open').forEach(t => t.classList.remove('open'));
        }
    });
}


// ════════════════════════════════════════════════════════════════════════════
// URL STATE — shareable filtered views
//
// Filter state and map position are serialised as a base64-encoded JSON blob
// in the URL hash. The hash is updated via replaceState (no back-button
// entries) after every filter change and every map move.
// ════════════════════════════════════════════════════════════════════════════

function pushStateToUrl() {
    // Serialise dropdownState: Sets → Arrays (JSON doesn't support Set)
    const dropdownSerial = {};
    APP_CONFIG.tabs.forEach(tab => {
        dropdownSerial[tab.key] = {};
        Object.entries(appState.dropdownState[tab.key] || {}).forEach(([col, set]) => {
            if (set && set.size > 0) dropdownSerial[tab.key][col] = [...set];
        });
    });

    // Serialise non-default range operators
    const operatorSerial = {};
    APP_CONFIG.tabs.forEach(tab => {
        const tabOps = appState._rangeOperator?.[tab.key] || {};
        const nonDefault = {};
        Object.entries(tabOps).forEach(([col, op]) => {
            if (op !== APP_CONFIG.rangeFilterColumns[col]) nonDefault[col] = op;
        });
        if (Object.keys(nonDefault).length) operatorSerial[tab.key] = nonDefault;
    });

    const state = {
        search:     appState.searchState,
        range:      appState.rangeState,
        operator:   Object.keys(operatorSerial).length ? operatorSerial : undefined,
        dropdown:   dropdownSerial,
        special:    appState.activeSpecialFilter,
        hiddenTabs: appState.hiddenTabs.size > 0 ? [...appState.hiddenTabs] : undefined,
        map: {
            lat:  parseFloat(map.getCenter().lat.toFixed(6)),
            lng:  parseFloat(map.getCenter().lng.toFixed(6)),
            zoom: map.getZoom(),
        },
    };
    try {
        const encoded = btoa(unescape(encodeURIComponent(JSON.stringify(state))));
        history.replaceState(null, '', `#${encoded}`);
    } catch (e) {
        console.warn('Could not serialise state to URL:', e);
    }
}

// Returns the decoded state object from the URL hash, or null if absent/invalid.
function readUrlState() {
    const hash = window.location.hash.slice(1);
    if (!hash) return null;
    if (hash.length > 10000) {
        console.warn('URL hash exceeds maximum length — ignoring');
        return null;
    }
    try {
        const state = JSON.parse(decodeURIComponent(escape(atob(hash))));
        if (!isValidRestoredState(state)) {
            console.warn('URL hash failed validation — ignoring');
            return null;
        }
        return state;
    } catch (e) {
        console.warn('Could not restore state from URL hash:', e);
        return null;
    }
}

function isValidRestoredState(state) {
    if (typeof state !== 'object' || state === null) return false;
    const knownKeys = new Set(APP_CONFIG.tabs.map(t => t.key));

    if (state.search !== undefined) {
        if (typeof state.search !== 'object' || state.search === null) return false;
        for (const [tabKey, cols] of Object.entries(state.search)) {
            if (!knownKeys.has(tabKey)) return false;
            if (typeof cols !== 'object' || cols === null) return false;
            for (const val of Object.values(cols)) {
                if (typeof val !== 'string') return false;
            }
        }
    }

    if (state.range !== undefined) {
        if (typeof state.range !== 'object' || state.range === null) return false;
        for (const [tabKey, cols] of Object.entries(state.range)) {
            if (!knownKeys.has(tabKey)) return false;
            if (typeof cols !== 'object' || cols === null) return false;
            for (const v of Object.values(cols)) {
                if (typeof v !== 'object' || v === null) return false;
                if (typeof v.value !== 'number' || !isFinite(v.value)) return false;
                if (v.operator !== 'gte' && v.operator !== 'lte') return false;
            }
        }
    }

    if (state.dropdown !== undefined) {
        if (typeof state.dropdown !== 'object' || state.dropdown === null) return false;
        const allowedCols = new Set(APP_CONFIG.dropdownColumns || []);
        for (const [tabKey, cols] of Object.entries(state.dropdown)) {
            if (!knownKeys.has(tabKey)) return false;
            if (typeof cols !== 'object' || cols === null) return false;
            for (const [col, vals] of Object.entries(cols)) {
                if (!allowedCols.has(col)) return false;
                if (!Array.isArray(vals)) return false;
                for (const v of vals) {
                    if (typeof v !== 'string') return false;
                }
            }
        }
    }

    if (state.operator !== undefined) {
        if (typeof state.operator !== 'object' || state.operator === null) return false;
        const knownRangeCols = new Set(Object.keys(APP_CONFIG.rangeFilterColumns || {}));
        for (const [tabKey, cols] of Object.entries(state.operator)) {
            if (!knownKeys.has(tabKey)) return false;
            if (typeof cols !== 'object' || cols === null) return false;
            for (const [col, op] of Object.entries(cols)) {
                if (!knownRangeCols.has(col)) return false;
                if (op !== 'gte' && op !== 'lte') return false;
            }
        }
    }

    if (state.special !== undefined && state.special !== null) {
        if (typeof state.special !== 'string') return false;
        if (!knownKeys.has(state.special)) return false;
    }

    if (state.hiddenTabs !== undefined) {
        if (!Array.isArray(state.hiddenTabs)) return false;
        const hideableKeys = new Set(
            APP_CONFIG.tabs.filter(t => t.hideable && !t.isPrimary).map(t => t.key)
        );
        for (const key of state.hiddenTabs) {
            if (typeof key !== 'string') return false;
            if (!hideableKeys.has(key)) return false;
        }
    }

    if (state.map !== undefined) {
        if (typeof state.map !== 'object' || state.map === null) return false;
        const { lat, lng, zoom } = state.map;
        if (!isFinite(lat) || lat < -90  || lat > 90)  return false;
        if (!isFinite(lng) || lng < -180 || lng > 180) return false;
        if (!isFinite(zoom) || zoom < 0  || zoom > 28) return false;
    }

    return true;
}

// Called before initMap — extracts only the map position from the hash so
// Leaflet can initialise at the correct location without triggering moveend.
function applyRestoredMapView() {
    const state = readUrlState();
    if (!state?.map) return;
    const { lat, lng, zoom } = state.map;
    if (isFinite(lat) && isFinite(lng) && isFinite(zoom)) {
        APP_CONFIG.mapCenter = [lat, lng];
        APP_CONFIG.mapZoom   = zoom;
    }
}

// Called after loadData and initial render — restores filter state and
// re-populates header inputs so the UI matches the encoded state.
function restoreStateFromUrl() {
    const state = readUrlState();
    if (!state) return;

    if (state.search) {
        APP_CONFIG.tabs.forEach(tab => {
            if (state.search[tab.key]) {
                appState.searchState[tab.key] = state.search[tab.key];
                // Populate visible filter inputs
                Object.entries(state.search[tab.key]).forEach(([col, val]) => {
                    if (!val) return;
                    const input = document.querySelector(
                        `input[data-table="${tab.key}"][data-column="${col}"]`
                    );
                    if (input) input.value = val;
                });
            }
        });
    }

    if (state.range) {
        APP_CONFIG.tabs.forEach(tab => {
            if (state.range[tab.key]) {
                appState.rangeState[tab.key] = state.range[tab.key];
                Object.entries(state.range[tab.key]).forEach(([col, rangeObj]) => {
                    const input = document.querySelector(
                        `input[data-table="${tab.key}"][data-column="${col}"]`
                    );
                    if (input) input.value = rangeObj.value;
                });
            }
        });
    }

    if (state.dropdown) {
        APP_CONFIG.tabs.forEach(tab => {
            if (!state.dropdown[tab.key]) return;
            Object.entries(state.dropdown[tab.key]).forEach(([col, vals]) => {
                appState.dropdownState[tab.key][col] = new Set(vals);
                // Update the summary button to reflect restored selection
                const btn = document.querySelector(
                    `.dd-summary[data-tab="${tab.key}"][data-col="${CSS.escape(col)}"]`
                );
                if (btn) updateDropdownSummary(btn, appState.dropdownState[tab.key][col]);
            });
        });
    }

    if (state.operator) {
        APP_CONFIG.tabs.forEach(tab => {
            if (!state.operator[tab.key]) return;
            appState._rangeOperator = appState._rangeOperator || {};
            appState._rangeOperator[tab.key] = appState._rangeOperator[tab.key] || {};
            Object.entries(state.operator[tab.key]).forEach(([col, op]) => {
                appState._rangeOperator[tab.key][col] = op;
                // Update visible badge if header already built
                const input = document.querySelector(
                    `input.range-input[data-table="${tab.key}"][data-column="${col}"]`
                );
                if (input) {
                    const badge = input.parentElement?.querySelector('.range-operator-btn');
                    if (badge) {
                        badge.textContent = op === 'gte' ? '≥' : '≤';
                        badge.title = op === 'gte'
                            ? 'Minimum — click to switch to maximum (≤)'
                            : 'Maximum — click to switch to minimum (≥)';
                    }
                }
            });
        });
    }

    if (state.special) {
        appState.activeSpecialFilter = state.special;
        updateDataFiltersBtn();
    }

    if (state.hiddenTabs) {
        appState.hiddenTabs = new Set(state.hiddenTabs);
        applyTabVisibility();
    }

    // Re-run filters now that state is restored
    if (state.search || state.range || state.operator || state.dropdown || state.special) {
        applyBoundsFilter();
    }
}




// ════════════════════════════════════════════════════════════════════════════
// SAFARI KEYBOARD NAVIGATION FIX
//
// Safari skips buttons and links in Tab order unless they have an explicit
// tabindex="0". Chrome/Firefox follow the spec and make all interactive
// elements focusable by default; Safari requires the attribute.
//
// A MutationObserver ensures every button/anchor added to the DOM —
// including dynamically created filter pills, zoom icons, dropdown controls,
// etc. — gets tabindex="0" automatically without touching every createElement.
// ════════════════════════════════════════════════════════════════════════════

function applySafariTabindex(root) {
    root.querySelectorAll('button:not([tabindex]), a[href]:not([tabindex])').forEach(el => {
        el.setAttribute('tabindex', '0');
    });
}

function initSafariTabFix() {
    applySafariTabindex(document.body);
    const observer = new MutationObserver(mutations => {
        mutations.forEach(mutation => {
            mutation.addedNodes.forEach(node => {
                if (node.nodeType !== Node.ELEMENT_NODE) return;
                if ((node.tagName === 'BUTTON' || node.tagName === 'A') &&
                    !node.hasAttribute('tabindex')) {
                    node.setAttribute('tabindex', '0');
                }
                applySafariTabindex(node);
            });
        });
    });
    observer.observe(document.body, { childList: true, subtree: true });
}

window.addEventListener('load', async () => {
    buildUI();
    wireEvents();
    initSafariTabFix();
    applyRestoredMapView();   // adjust mapCenter/mapZoom from hash before Leaflet initialises
    initMap();
    buildLegend();
    await loadData();
    populateDeploymentSwitcher();
    // Add cluster group to map now that geomType is known — only for point data
    if (appState.clusterGroup && appState.geomType === 'point') {
        map.addLayer(appState.clusterGroup);
    }
    buildLegend();            // re-render legend now that legendValues is populated
    plotLocations();
    APP_CONFIG.tabs.forEach(tab => renderTable(tab.key));
    updateAllDropdownOptions(); // populate options from initial bounds snapshot
    restoreStateFromUrl();    // restore filter state and re-run filters if hash present
    applyTabVisibility();     // apply any tab visibility from restored state or defaults
    updateDataFiltersBtn();   // sync Data Filters button label with restored state
});
