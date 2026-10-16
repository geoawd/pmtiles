import * as maplibregl from 'https://unpkg.com/maplibre-gl@6.13.0/dist/maplibre-gl.mjs';
import { buildJsonFeatures, createJsonThemeState, filterJsonRows, hasJsonFilters, jsonGeometryCenter, jsonGeometryIntersectsBounds, loadJsonThemeConfig, loadJsonThemeData } from './json-theme-runtime.js';

window.maplibregl = maplibregl;
const CONFIG = window.CONFIG;
proj4.defs('EPSG:29902',
  '+proj=tmerc +lat_0=53.5 +lon_0=-8 +k=1.000035 +x_0=200000 +y_0=250000 ' +
  '+ellps=mod_airy +towgs84=482.5,-130.6,564.6,-1.042,-0.214,-0.631,8.15 +units=m +no_defs');
maplibregl.addProtocol('pmtiles', new pmtiles.Protocol().tile);
if (window.MaplibreCOGProtocol) maplibregl.addProtocol('cog', MaplibreCOGProtocol.cogProtocol);
const $ = id => document.getElementById(id);
const map = new maplibregl.Map({ container: 'map', style: window.MAP_STYLE || CONFIG.styleUrl, center: CONFIG.center, zoom: CONFIG.zoom, maxPitch: 80 });
document.querySelectorAll('#aboutPage .lgcollapse').forEach(b => b.onclick = () => {
  b.setAttribute('aria-expanded', String(!b.closest('.lgroup').classList.toggle('collapsed')));
});
map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), 'top-right');
const boundsValid = Array.isArray(CONFIG.bounds) && CONFIG.bounds.length === 2 && CONFIG.bounds.every(p =>
  Array.isArray(p) && p.length === 2 && p.every(Number.isFinite)) &&
  CONFIG.bounds[0][0] >= -180 && CONFIG.bounds[1][0] <= 180 &&
  CONFIG.bounds[0][1] >= -85.051129 && CONFIG.bounds[1][1] <= 85.051129 &&
  CONFIG.bounds[0][0] < CONFIG.bounds[1][0] && CONFIG.bounds[0][1] < CONFIG.bounds[1][1];
if (boundsValid) map.addControl({
  onAdd() {
    const group = document.createElement('div');
    group.className = 'maplibregl-ctrl maplibregl-ctrl-group';
    const button = document.createElement('button');
    button.className = 'maplibregl-ctrl-icon maplibregl-ctrl-zoomall';
    button.type = 'button'; button.title = 'Zoom to all extents'; button.setAttribute('aria-label', button.title);
    button.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9V4h5M4 4l6 6M20 15v5h-5m5 0-6-6"/></svg>';
    button.onclick = () => map.fitBounds(CONFIG.bounds, { padding: 40, duration: 700 });
    group.appendChild(button);
    return group;
  },
  onRemove() {}
}, 'top-right');
map.addControl(new maplibregl.ScaleControl());
map.addControl(new maplibregl.GeolocateControl({ trackUserLocation: false }), 'top-right');
new ResizeObserver(() => map.resize()).observe($('mapwrap'));   // keeps the map right when menu / results change
const panelSplitter = $('panelSplitter');
const resultsPanel = $('panel');
const mainView = $('main');
const MIN_PANEL_HEIGHT = 150;
const MIN_MAP_HEIGHT = 160;
function panelHeightLimits() {
  return { min: MIN_PANEL_HEIGHT, max: Math.max(MIN_PANEL_HEIGHT, mainView.clientHeight - MIN_MAP_HEIGHT - panelSplitter.offsetHeight) };
}
function setPanelHeight(height, userResized = false) {
  const limits = panelHeightLimits();
  const next = Math.max(limits.min, Math.min(limits.max, height));
  if (userResized) activeJsonThemeState.panelManuallySized = true;
  resultsPanel.style.height = `${next}px`;
  panelSplitter.setAttribute('aria-valuemin', String(limits.min));
  panelSplitter.setAttribute('aria-valuemax', String(Math.round(limits.max)));
  panelSplitter.setAttribute('aria-valuenow', String(Math.round(next)));
  map.resize();
}
panelSplitter.addEventListener('pointerdown', event => {
  if (!document.body.classList.contains('has-table')) return;
  event.preventDefault();
  const startY = event.clientY;
  const startHeight = resultsPanel.getBoundingClientRect().height;
  panelSplitter.setPointerCapture(event.pointerId);
  const move = moveEvent => setPanelHeight(startHeight + startY - moveEvent.clientY, true);
  const finish = () => {
    panelSplitter.removeEventListener('pointermove', move);
    panelSplitter.removeEventListener('pointerup', finish);
    panelSplitter.removeEventListener('pointercancel', finish);
  };
  panelSplitter.addEventListener('pointermove', move);
  panelSplitter.addEventListener('pointerup', finish);
  panelSplitter.addEventListener('pointercancel', finish);
});
panelSplitter.addEventListener('keydown', event => {
  const current = resultsPanel.getBoundingClientRect().height;
  if (event.key === 'ArrowUp') { event.preventDefault(); setPanelHeight(current + 24, true); }
  else if (event.key === 'ArrowDown') { event.preventDefault(); setPanelHeight(current - 24, true); }
  else if (event.key === 'Home') { event.preventDefault(); setPanelHeight(MIN_PANEL_HEIGHT, true); }
  else if (event.key === 'End') { event.preventDefault(); setPanelHeight(panelHeightLimits().max, true); }
});

const isLink = v => typeof v === 'string' && /^https:/i.test(v.trim());
const esc = s => String(s).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const cell = v => v === null || v === undefined ? '' :
  isLink(v) ? `<a href="${esc(v.trim())}" target="_blank" rel="noopener">${esc(v)}</a>` : esc(v);

if (CONFIG.showZoom) {
  const zoomEl = $('zoomLevel');
  zoomEl.hidden = false;
  const showZoom = () => zoomEl.textContent = 'Zoom ' + map.getZoom().toFixed(1);
  map.on('zoom', showZoom);
  showZoom();
}
map.on('mousemove', e => {
  const [x, y] = proj4('EPSG:4326', 'EPSG:29902', [e.lngLat.lng, e.lngLat.lat]);
  $('coords').textContent = `Irish Grid  E ${x.toFixed(0)}  N ${y.toFixed(0)}`;
});

// ---------- Menu ----------
let tool = null;
const isMobile = () => matchMedia('(max-width: 700px)').matches;
let thirdPartyNoticesRequest = null;
function loadThirdPartyNotices() {
  if (thirdPartyNoticesRequest) return thirdPartyNoticesRequest;
  const content = $('thirdPartyNotices');
  content.textContent = 'Loading notices...';
  thirdPartyNoticesRequest = fetch('notices.txt')
    .then(response => {
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return response.text();
    })
    .then(text => { content.textContent = text; })
    .catch(() => {
      content.textContent = 'Third-party notices could not be loaded.';
      thirdPartyNoticesRequest = null;
    });
  return thirdPartyNoticesRequest;
}
///////////////////////////////////////////////////////////////////////////
// Opens the selected side drawer tool and updates the active rail button.
///////////////////////////////////////////////////////////////////////////
function openTool(name) {
  tool = name === tool ? null : name;
  document.body.classList.toggle('drawer-open', !!tool);
  document.querySelectorAll('#rail [data-tool]').forEach(b => b.classList.toggle('active', b.dataset.tool === tool));
  $('legendPage').classList.toggle('active', tool === 'legend');
  $('searchPage').classList.toggle('active', tool === 'search');
  $('aboutPage').classList.toggle('active', tool === 'about');
  if (tool === 'about') loadThirdPartyNotices();
  if (tool === 'search') { updateSearchFields(); if (!isMobile()) $('searchText').focus(); }
  if (tool && boxMode) setBox(false);
  syncAddDataButton();
}
function syncAddDataButton() {
  const button = $('addDataBtn');
  if (!button) return;
  const active = tool === 'legend' && !$('addDataPanel').hidden;
  button.classList.toggle('active', active);
  button.setAttribute('aria-pressed', String(active));
}
document.querySelectorAll('#rail [data-tool]').forEach(b => b.onclick = () => openTool(b.dataset.tool));
document.querySelectorAll('.dclose').forEach(b => b.onclick = () => openTool(tool));

// ---------- Query helpers ----------
function dataLayers() {
  const geojson = (CONFIG.overlays || []).filter(w => w.geojson).flatMap(w => w.layerIds || [w.id]).filter(id => map.getLayer(id));
  if (CONFIG.queryLayers) return [...CONFIG.queryLayers, ...geojson];
  const st = map.getStyle();
  return [...st.layers.filter(l => l.source && st.sources[l.source] && st.sources[l.source].type === 'vector').map(l => l.id), ...geojson];
}
///////////////////////////////////////////////////////////////////////////
// Queries and deduplicates rendered vector features within a screen geometry.
///////////////////////////////////////////////////////////////////////////
function queryData(geom) {
  const layers = dataLayers();
  if (!layers.length) return [];
  const seen = new Set();
  return map.queryRenderedFeatures(geom, { layers }).filter(f => {
    const overlay = (CONFIG.overlays || []).find(w => w.geojson && (w.layerIds || [w.id]).includes(f.layer.id));
    if (overlay) f.sourceLayer = overlay.name || overlay.id;   // popup / table heading
    const key = f.source + '|' + (f.sourceLayer || '') + '|' + (f.id ?? '') + '|' + JSON.stringify(f.properties);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
const around = (p, r = 5) => [[p.x - r, p.y - r], [p.x + r, p.y + r]];
const wholeMap = () => { const c = map.getCanvas(); return [[0, 0], [c.clientWidth, c.clientHeight]]; };

// ---------- Click popup ----------
// CONFIG.dataLinks: { <vector layer>: { field, links: [{ label, file, dataKey?, field? }] } } joins JSON rows to clicked / selected features.
const linkIndexes = new Map();
function linkIndex(link, defaultField) {
  const field = link.field || defaultField;
  const key = `${link.file}|${link.dataKey || ''}|${field}`;
  if (!linkIndexes.has(key)) {
    linkIndexes.set(key, fetch(link.file).then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); }).then(json => {
      const rows = link.dataKey ? json[link.dataKey] : Object.values(json).find(Array.isArray);
      const index = new Map();
      (Array.isArray(rows) ? rows : []).forEach(row => {
        if (row[field] == null) return;
        const k = String(row[field]);
        if (!index.has(k)) index.set(k, []);
        index.get(k).push(row);
      });
      return index;
    }).catch(error => { linkIndexes.delete(key); throw error; }));
  }
  return linkIndexes.get(key);
}
// Returns the features grouped by layer, with each layer's linked rows (pseudo-features carrying the parent's geometry) straight after it.
async function withLinked(feats) {
  const layerOf = f => f.sourceLayer || f.layer.id;
  const ordered = [];
  for (const layer of new Set(feats.map(layerOf))) {
    const parents = feats.filter(f => layerOf(f) === layer);
    ordered.push(...parents, ...await linkedFor(layer, parents));
  }
  return ordered;
}
async function linkedFor(layer, parents) {
  const out = [];
  const def = (CONFIG.dataLinks || {})[layer];
  if (def) {
    for (const link of def.links || []) {
      let index;
      try { index = await linkIndex(link, def.field); }
      catch (error) { toast(`Could not load linked data ${link.label || link.file}: ${error.message}`); continue; }
      const seen = new Set();
      parents.forEach(parent => {
        const id = parent.properties?.[def.field];
        if (id == null || seen.has(String(id))) return;
        seen.add(String(id));
        (index.get(String(id)) || []).forEach(row => out.push({
          sourceLayer: `${layer}: ${link.label || link.file}`, linked: true, parent, parentLayer: layer, geometry: parent.geometry, properties: row
        }));
      });
    }
  }
  return out;
}

let boxMode = false, justBoxed = false;
map.on('click', async e => {
  if (boxMode || justBoxed) return;
  const feats = queryData(around(e.point));
  const geometryConfig = activeJsonThemeState.active ? activeJsonThemeConfig() : null;
  if (geometryConfig?.geometryDataset) {
    const hit = feats.find(f => datasetGeometryLayerIds(geometryConfig).includes(f.layer.id) &&
      activeJsonThemeState.featureById.has(String(f.properties?.[geometryConfig.geometryLinkField || geometryConfig.linkField])));
    if (hit) { showJsonThemePopup({ features: [hit], lngLat: e.lngLat }); return; }
  }
  if (!feats.length) return;
  const groups = {};   // one collapsible section per layer, each with its own pager
  (await withLinked(feats)).forEach(f => (groups[f.sourceLayer || f.layer.id] ||= []).push(f));
  const wrap = document.createElement('div');
  wrap.className = 'idwrap';
  const title = document.createElement('div');
  title.className = 'idtitle';
  title.setAttribute('role', 'heading');
  title.setAttribute('aria-level', '2');
  title.textContent = 'Results';
  const layers = document.createElement('div');
  layers.className = 'idlayers';
  wrap.append(title, layers);
  const toggleSection = sec => {
    const expand = sec.classList.contains('collapsed');
    if (expand) layers.querySelectorAll('.idsec:not(.collapsed)').forEach(active => {
      active.classList.add('collapsed');
      active.querySelector('.idhead').setAttribute('aria-expanded', 'false');
    });
    sec.classList.toggle('collapsed', !expand);
    sec.querySelector('.idhead').setAttribute('aria-expanded', String(expand));
  };
  const linkedSecs = {}, parentSyncs = [];   // linked sections only show rows of the parent record currently displayed
  Object.entries(groups).forEach(([name, list], gi) => {
    let items = list;
    let i = 0;
    const isLinked = !!list[0].linked;
    const sec = document.createElement('section');
    sec.className = 'idsec' + (gi ? ' collapsed' : '') + (isLinked ? ' linked' : '');
    sec.innerHTML =
      `<div class="idhead" tabindex="0" role="button" aria-expanded="${!gi}"><svg viewBox="0 0 24 24"><path d="m6 9 6 6 6-6"/></svg>` +
      `<span class="idname">${esc(name.replace(/_/g, ' '))}</span><span class="idcount"></span></div>` +
      `<div class="idbody"><div class="idtab"></div><div class="pophead"><button class="nav" data-d="-1" aria-label="Previous record">&#9664;</button>` +
      `<span class="pg"></span><button class="nav" data-d="1" aria-label="Next record">&#9654;</button></div></div>`;
    const head = sec.querySelector('.idhead');
    const toggle = () => toggleSection(sec);
    head.onclick = toggle;
    head.onkeydown = ev => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); toggle(); } };
    const render = () => {
      const n = items.length;
      sec.hidden = !n;
      sec.querySelector('.idcount').textContent = `(${n})`;
      sec.querySelector('.pophead').hidden = n < 2;
      if (!n) return;
      sec.querySelector('.pg').textContent = `${i + 1} of ${n}`;
      const entries = Object.entries(items[i].properties || {}).filter(([, v]) =>
        v !== null && v !== undefined && (typeof v !== 'string' || v.trim() !== ''));
      sec.querySelector('.idtab').innerHTML = entries.length
        ? entries.map(([k, v]) => `<div class="arow"><div class="akey">${esc(k)}</div><div class="aval">${cell(v)}</div></div>`).join('')
        : '<div class="idempty">No attributes with values.</div>';
      if (!isLinked) (linkedSecs[name] || []).forEach(s => s(items[i]));
    };
    if (isLinked) (linkedSecs[list[0].parentLayer] ||= []).push(parent => { items = list.filter(f => f.parent === parent); i = 0; render(); });
    else parentSyncs.push(render);
    sec.querySelectorAll('.nav').forEach(b => b.onclick = () => { i = (i + Number(b.dataset.d) + items.length) % items.length; render(); });
    render();
    layers.appendChild(sec);
  });
  parentSyncs.forEach(render => render());
  new maplibregl.Popup({ maxWidth: '360px', className: 'idpop' }).setLngLat(e.lngLat).setDOMContent(wrap).addTo(map);
});
map.on('mousemove', e => {
  if (!boxMode) map.getCanvas().style.cursor = queryData(around(e.point, 3)).length ? 'pointer' : '';
});

// ---------- Legend ----------
const OPS = { '<=': '≤', '>=': '≥', '<': '<', '>': '>', '==': '=', '!=': '≠' };
const fmtFilter = f => {
  if (!f) return null;
  if (OPS[f[0]] && Array.isArray(f[1]) && f[1][0] === 'get') return `${f[1][1]} ${OPS[f[0]]} ${f[2]}`;
  return JSON.stringify(f).slice(0, 40);
};
const col = (v, d = '#999') => (typeof v === 'string' ? v.replace(/["'<>;]/g, '') : d);
const layerVisibility = new Map();
function registerLayerVisibility(id, selected) {
  if (!layerVisibility.has(id)) layerVisibility.set(id, { selected, inTheme: true, groups: new Set() });
  syncLayerVisibility(id);
}
function syncLayerVisibility(id) {
  const state = layerVisibility.get(id);
  if (!state || !map.getLayer(id)) return;
  map.setLayoutProperty(id, 'visibility', state.selected && state.inTheme && !state.groups.size ? 'visible' : 'none');
}
function setVis(ids, on) {
  ids.forEach(id => {
    const state = layerVisibility.get(id) || { selected: false, inTheme: true, groups: new Set() };
    state.selected = on;
    layerVisibility.set(id, state);
    syncLayerVisibility(id);
  });
  updateScaleState();
  updateArcgisLegendInView();
}
function setThemeVisibility(ids, on) {
  ids.forEach(id => {
    const state = layerVisibility.get(id);
    if (!state) return;
    state.inTheme = on;
    syncLayerVisibility(id);
  });
  updateArcgisLegendInView();
}
function setGroupVisibility(ids, key, on) {
  ids.forEach(id => {
    const state = layerVisibility.get(id);
    if (!state) return;
    on ? state.groups.delete(key) : state.groups.add(key);
    syncLayerVisibility(id);
  });
  updateArcgisLegendInView();
}

// ---- data-driven colours: a 'match' (or 'step') colour expression becomes one legend entry per class ----
const COLOR_PROP = { fill: 'fill-color', circle: 'circle-color', line: 'line-color' };
const isClear = c => /transparent|,\s*0\)$|^#[0-9a-f]{6}00$/i.test(c.trim());
const fieldOf = x => Array.isArray(x) ? (x[0] === 'get' ? x[1] : x[0] === 'coalesce' ? fieldOf(x[1]) : null) : null;
function colorClasses(l) {
  const e = (l.paint || {})[COLOR_PROP[l.type]];
  if (!Array.isArray(e)) return null;
  const out = [];
  if (e[0] === 'match') {
    const input = e[1], all = [];
    for (let i = 2; i < e.length - 1; i += 2) {
      if (typeof e[i + 1] !== 'string') return null;
      const labels = Array.isArray(e[i]) ? e[i] : [e[i]];
      all.push(...labels);
      out.push({ text: labels.join(', '), color: e[i + 1], test: ['match', input, labels, true, false], labels, field: fieldOf(input) });
    }
    const fb = e[e.length - 1];
    if (CONFIG.legendOther && typeof fb === 'string' && !isClear(fb)) out.push({ text: 'Other', color: fb, test: ['!', ['match', input, all, true, false]], other: true, all: new Set(all.map(String)), field: fieldOf(input) });
  } else if (e[0] === 'step') {
    const input = e[1], stops = [-Infinity], cols = [e[2]];
    for (let i = 3; i < e.length - 1; i += 2) { stops.push(e[i]); cols.push(e[i + 1]); }
    if (cols.some(c => typeof c !== 'string')) return null;
    cols.forEach((color, i) => {
      const lo = stops[i], hi = i + 1 < stops.length ? stops[i + 1] : Infinity, conds = [];
      if (lo > -Infinity) conds.push(['>=', input, lo]);
      if (hi < Infinity) conds.push(['<', input, hi]);
      out.push({ text: lo === -Infinity ? `< ${hi}` : hi === Infinity ? `≥ ${lo}` : `${lo} – ${hi}`, color, test: ['all', ...conds], lo, hi, field: fieldOf(input) });
    });
  }
  return out.length ? out : null;
}
// Switch one legend entry on/off. Class entries work by filtering the layer; hiding every class hides the layer.
function applyEntry(en, on) {
  if (!en.cls) return setVis(en.ids, on);
  const st = en.state;
  on ? st.hidden.delete(en.cls) : st.hidden.add(en.cls);
  const conds = [...st.hidden].map(c => ['!', c.test]);
  en.ids.forEach(id => {
    const f0 = st.orig[id];
    map.setFilter(id, conds.length ? (f0 ? ['all', f0, ...conds] : ['all', ...conds]) : (f0 || null));
  });
  setVis(en.ids, st.hidden.size < st.total);
  updateScaleState();
}

function swatch(l, dot, color) {   // `color` overrides the layer colour (used for data-driven classes)
  const p = l.paint || {};
  let inner;
  if (l.type === 'circle') {
    const d = Math.max(8, Math.min(16, (p['circle-radius'] || 5) * 2));
    inner = `<i style="width:${d}px;height:${d}px;border-radius:50%;background:${color ? col(color) : col(p['circle-color'])};border:1px solid ${col(p['circle-stroke-color'], '#000')}">${dot ? '<b></b>' : ''}</i>`;
  } else if (l.type === 'fill') {
    inner = `<i style="width:16px;height:12px;background:${color ? col(color) : col(p['fill-color'])};opacity:${typeof p['fill-opacity'] === 'number' ? p['fill-opacity'] : 1};border:1px solid ${col(p['fill-outline-color'], 'rgba(0,0,0,.4)')}"></i>`;
  } else {
    inner = `<i style="width:16px;height:0;border-top:${Math.max(2, p['line-width'] || 2)}px solid ${color ? col(color) : col(p['line-color'])}"></i>`;
  }
  return `<span class="sw">${inner}</span>`;
}

const isUrl = u => typeof u === 'string' && /^https?:\/\//i.test(u.trim());
const ICON_SLIDERS = '<svg viewBox="0 0 24 24"><path d="M4 7h10M18 7h2M4 17h2M10 17h10"/><circle cx="16" cy="7" r="2"/><circle cx="8" cy="17" r="2"/></svg>';
const ICON_INFO = '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/></svg>';
const ICON_EYE = '<svg viewBox="0 0 24 24"><path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12z"/><circle cx="12" cy="12" r="3"/></svg>';
const ICON_EYE_OFF = '<svg viewBox="0 0 24 24"><path d="M3 3l18 18M10.6 10.6a2 2 0 002.8 2.8M9.9 5.2A11 11 0 0112 5c7 0 11 7 11 7a15 15 0 01-4 4.8M6.2 6.2C2.9 8.1 1 12 1 12s4 7 11 7a10 10 0 004.1-.9"/></svg>';
// Small per-layer panel: transparency slider + optional info link. Returns { btn, panel }.
const ICON_EXT = '<svg viewBox="0 0 24 24"><path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/></svg>';

// ---- metadata ("i") panel: fetches a JSON record and shows the fields listed in CONFIG.infoFields ----
const getPath = (o, p) => String(p).match(/[^.\[\]]+/g).reduce((x, k) => (x == null ? undefined : x[k]), o);
const toStrings = v => v == null ? [] : Array.isArray(v) ? v.flatMap(toStrings)
  : typeof v === 'object' ? ('default' in v ? toStrings(v.default) : []) : [String(v)];
const fmtDate = t => { const d = new Date(t); return isNaN(d) ? String(t) : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }); };
const linkify = t => esc(t).replace(/https?:\/\/[^\s<]+/g, m => {
  const tail = (m.match(/[.,;:)]+$/) || [''])[0], u = m.slice(0, m.length - tail.length);
  return `<a href="${u}" target="_blank" rel="noopener">${u}</a>${tail}`;
});
function infoValue(v, format, data) {
  if (typeof format === 'function') { const r = format(v, data); return r ? linkify(String(r)) : ''; }
  const a = toStrings(v).map(x => x.trim()).filter(Boolean);
  if (!a.length) return '';
  switch (format) {
    case 'date': return esc(fmtDate(a[0]));
    case 'daterange': return esc(a.map(x => x === '..' ? 'present' : fmtDate(x)).join(' – '));
    case 'scale': return esc('1:' + Number(a[0]).toLocaleString('en-GB'));
    case 'email': return `<a href="mailto:${esc(a[0])}">${esc(a[0])}</a>`;
    case 'link': return isUrl(a[0]) ? `<a href="${esc(a[0])}" target="_blank" rel="noopener">${esc(a[0])}</a>` : esc(a[0]);
    case 'list': return esc(a.join(', '));
    case 'lines': return a.map(linkify).join('<br>');
    default: return a.map(linkify).join(', ');
  }
}
function metaUrls(m) {
  const page = new URL(m.metadata, location.href), json = new URL(page);
  json.searchParams.set('f', 'json');
  page.searchParams.delete('f');
  return { json: json.href, page: m.page || page.href };
}
const metaCache = {};
const fetchMeta = url => metaCache[url] ||= fetch(url).then(r => { if (!r.ok) throw new Error(r.status); return r.json(); })
  .catch(e => { delete metaCache[url]; throw e; });
function renderInfo(data, meta) {
  let h = '';
  (meta.fields || CONFIG.infoFields || []).forEach(f => {
    const v = infoValue(getPath(data, f.path), f.format, data);
    if (!v) return;
    h += f.format === 'title' ? `<div class="ititle">${v}</div>`
      : `<div class="irow">${f.label ? `<div class="ilabel">${esc(f.label)}</div>` : ''}<div>${v}</div></div>`;
  });
  return h || '<span class="hint">No information found in the record.</span>';
}
function infoTool(meta) {
  const btn = document.createElement('button');
  btn.className = 'tbtn'; btn.innerHTML = ICON_INFO; btn.title = 'Layer information';
  btn.setAttribute('aria-label', 'Layer information'); btn.setAttribute('aria-expanded', 'false');
  const panel = document.createElement('div');
  panel.className = 'lpanel infopanel'; panel.hidden = true;
  const urls = metaUrls(meta);
  const foot = `<div class="ifoot"><a href="${esc(urls.page)}" target="_blank" rel="noopener">${ICON_EXT}${esc(meta.linkText || 'View full metadata record')}</a></div>`;
  let state = 0;   // 0 = not loaded, 1 = loading, 2 = done
  btn.onclick = async () => {
    panel.hidden = !panel.hidden;
    btn.setAttribute('aria-expanded', String(!panel.hidden));
    if (panel.hidden) return;
    const c = btn.closest('.lcollapsed');   // opening the info also expands a collapsed layer
    if (c) { c.classList.remove('lcollapsed'); const cb = c.querySelector('.cbtn'); if (cb) cb.setAttribute('aria-expanded', 'true'); }
    if (state === 0) {
      state = 1;
      panel.innerHTML = '<span class="hint">Loading…</span>' + foot;
      try { panel.innerHTML = renderInfo(await fetchMeta(urls.json), meta) + foot; state = 2; }
      catch (e) { state = 0; panel.innerHTML = '<span class="hint">The information could not be loaded here. Use the link to view the record.</span>' + foot; }
    }
    panel.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  };
  return { btn, panel };
}

// Layer's own info wins, then the id's entry in CONFIG.layerInfo, then its group's entry in CONFIG.groupInfo.
const infoFor = (id, group, own) => own ?? (CONFIG.layerInfo || {})[id] ?? (CONFIG.groupInfo || {})[group];
// Small per-layer panel: transparency slider (+ optional plain info link). Returns { btn, panel, infoBtn, infoPanel }.
function layerTools(transp, info, onChange, extraHtml = '') {
  const meta = info && typeof info === 'object' && info.metadata ? info : null;
  const link = typeof info === 'string' ? info : meta && meta.link;
  const btn = document.createElement('button');
  btn.className = 'tbtn'; btn.innerHTML = ICON_SLIDERS;
  btn.title = 'Transparency' + (isUrl(link) ? ' and information' : '');
  btn.setAttribute('aria-label', btn.title); btn.setAttribute('aria-expanded', 'false');
  const panel = document.createElement('div');
  panel.className = 'lpanel'; panel.hidden = true;
  panel.innerHTML = `<label class="trow">Transparency <input type="range" min="0" max="100" value="${transp}"><span class="tval">${transp}%</span></label>` +
    extraHtml +
    (isUrl(link) ? `<a href="${esc(link.trim())}" target="_blank" rel="noopener">${ICON_INFO}About this layer</a>` : '');
  const rng = panel.querySelector('input'), val = panel.querySelector('.tval');
  rng.oninput = () => { val.textContent = rng.value + '%'; onChange(Number(rng.value)); };
  btn.onclick = () => { panel.hidden = !panel.hidden; btn.setAttribute('aria-expanded', String(!panel.hidden)); };
  const it = meta ? infoTool(meta) : {};
  return { btn, panel, infoBtn: it.btn, infoPanel: it.panel };
}
// Vector layers: scale each style layer's opacity properties (keeps any data-driven expression)
const OPACITY_PROPS = { fill: ['fill-opacity'], circle: ['circle-opacity', 'circle-stroke-opacity'], line: ['line-opacity'] };
const origOpacity = {};
function setTransparency(sl, pct) {
  const f = 1 - pct / 100;
  map.getStyle().layers.filter(l => l['source-layer'] === sl).forEach(l => (OPACITY_PROPS[l.type] || []).forEach(prop => {
    const k = l.id + '|' + prop;
    if (!(k in origOpacity)) { const o = map.getPaintProperty(l.id, prop); origOpacity[k] = o == null ? 1 : o; }
    const o = origOpacity[k];
    map.setPaintProperty(l.id, prop, f === 1 ? o : typeof o === 'number' ? o * f : ['*', f, o]);
  }));
}
const ICON_CHEV = '<svg viewBox="0 0 24 24"><path d="m6 9 6 6 6-6"/></svg>';
const ICON_MINUS = '<svg viewBox="0 0 24 24"><path d="M5 12h14"/></svg>';
function collapser(target, startCollapsed) {   // chevron that collapses a layer's classes / panel
  const b = document.createElement('button');
  b.className = 'cbtn'; b.innerHTML = ICON_CHEV; b.title = 'Collapse or expand';
  b.setAttribute('aria-label', 'Collapse or expand layer');
  const set = c => { target.classList.toggle('lcollapsed', c); b.setAttribute('aria-expanded', String(!c)); };
  b.onclick = () => set(!target.classList.contains('lcollapsed'));
  set(!!startCollapsed);
  return b;
}
const ctl = { data: {}, ov: {} };   // switches used by themes
let groupSequence = 0;
function addGroup(parent, name) {
  const sec = document.createElement('section');
  sec.className = 'lgroup';
  sec.dataset.orderKey = `group:${name}`;
  sec.dataset.groupName = name;
  sec.innerHTML = `<h4 class="lghead"><button class="lgcollapse" type="button" aria-expanded="true"><span>${esc(name)}</span>` +
    `<svg viewBox="0 0 24 24"><path d="m6 9 6 6 6-6"/></svg></button>` +
    `<button class="lremove" type="button" hidden title="Remove manually added layers from ${esc(name)}" aria-label="Remove manually added layers from ${esc(name)}">${ICON_MINUS}</button>` +
    `<button class="lgeye" type="button" aria-pressed="false" title="Hide ${esc(name)}" aria-label="Hide ${esc(name)}">${ICON_EYE}</button></h4>` +
    '<div class="lgbody"></div>';
  const group = { key: `legend-group-${++groupSequence}`, body: sec.querySelector('.lgbody'), layerIds: new Set(), onVisibilityChange: null };
  const collapse = sec.querySelector('.lgcollapse');
  const remove = sec.querySelector('.lremove');
  const eye = sec.querySelector('.lgeye');
  const head = sec.querySelector('.lghead');
  head.draggable = true;
  head.title = 'Drag to reorder group';
  collapse.onclick = () => {
    const collapsed = sec.classList.toggle('collapsed');
    collapse.setAttribute('aria-expanded', String(!collapsed));
  };
  let visible = true;
  group.setVisibility = on => {
    visible = on;
    eye.innerHTML = visible ? ICON_EYE : ICON_EYE_OFF;
    const label = `${visible ? 'Hide' : 'Show'} ${name}`;
    eye.title = label;
    eye.setAttribute('aria-label', label);
    eye.setAttribute('aria-pressed', String(!visible));
    sec.classList.toggle('group-hidden', !visible);
    setGroupVisibility([...group.layerIds], group.key, visible);
    if (group.onVisibilityChange) group.onVisibilityChange(visible);
  };
  remove.onclick = event => { event.stopPropagation(); removeManualGroupAdditions(sec); };
  eye.onclick = () => group.setVisibility(!visible);
  parent.appendChild(sec);
  return group;
}
function enableLegendReordering() {
  const root = $('legend');
  let dragged = null;
  let dragHandle = null;
  let moved = false;
  root.addEventListener('pointerdown', event => {
    const groupName = event.target.closest('.lgcollapse span');
    const groupHead = groupName?.closest('.lghead');
    if (groupHead?.parentElement?.parentElement === root) {
      dragHandle = { type: 'group', element: groupHead.parentElement };
      return;
    }
    const item = event.target.closest('.lgbody > [data-order-key]');
    const layerName = event.target.closest('.lname span');
    dragHandle = item && layerName && item.contains(layerName) ? { type: 'item', element: item } : null;
  });
  root.addEventListener('pointerup', () => { dragHandle = null; });
  root.addEventListener('pointercancel', () => { dragHandle = null; });
  root.addEventListener('dragstart', event => {
    if (!dragHandle || !dragHandle.element.contains(event.target)) {
      event.preventDefault();
      dragHandle = null;
      return;
    }
    dragged = dragHandle;
    dragHandle = null;
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', dragged.element.dataset.orderKey);
    dragged.element.classList.add('dragging');
    moved = false;
  });
  root.addEventListener('dragover', event => {
    if (!dragged) return;
    root.querySelectorAll('.drop-before, .drop-after').forEach(element => element.classList.remove('drop-before', 'drop-after'));
    const group = event.target.closest('.lgroup');
    if (dragged.type === 'group' && group?.parentElement === root && group !== dragged.element) {
      event.preventDefault();
      const after = event.clientY > group.getBoundingClientRect().top + group.offsetHeight / 2;
      group.classList.add(after ? 'drop-after' : 'drop-before');
      const anchor = after ? group.nextSibling : group;
      if (anchor !== dragged.element) { root.insertBefore(dragged.element, anchor); moved = true; }
      return;
    }
    const target = event.target.closest('.lgbody > [data-order-key]');
    if (dragged.type !== 'item' || !target || target === dragged.element || target.parentElement !== dragged.element.parentElement) return;
    event.preventDefault();
    const after = event.clientY > target.getBoundingClientRect().top + target.offsetHeight / 2;
    target.classList.add(after ? 'drop-after' : 'drop-before');
    const anchor = after ? target.nextSibling : target;
    if (anchor !== dragged.element) { target.parentElement.insertBefore(dragged.element, anchor); moved = true; }
  });
  root.addEventListener('dragend', () => {
    root.querySelectorAll('.dragging, .drop-before, .drop-after').forEach(element => element.classList.remove('dragging', 'drop-before', 'drop-after'));
    if (moved) syncMapLayerOrder();
    dragged = null;
    dragHandle = null;
    moved = false;
  });
}
function syncMapLayerOrder() {
  const groups = [...$('legend').children].filter(group => group.matches('.lgroup'));
  const blocks = groups.reverse().flatMap(group => [...group.querySelector('.lgbody').children].reverse().flatMap(item => {
    const key = item.dataset.orderKey || '';
    if (key.startsWith('layer:')) {
      const sourceLayer = item.dataset.sl;
      return map.getStyle().layers.filter(layer => layer['source-layer'] === sourceLayer).map(layer => layer.id);
    }
    const id = key.replace(/^(overlay|basemap):/, '');
    const overlay = allOverlays().find(entry => entry.id === id);
    return (overlay?.layerIds || [id]).filter(layerId => map.getLayer(layerId));
  }));
  const layers = [...new Set(blocks.filter(id => map.getLayer(id)))];
  let beforeId;
  for (let index = layers.length - 1; index >= 0; index -= 1) {
    map.moveLayer(layers[index], beforeId);
    beforeId = layers[index];
  }
}
let themeLayers = null;   // null = every layer; otherwise the layer names allowed by the active theme
let themeBaseLayers = [];
let activeThemeName = null;
let activeThemeAll = false;
let themeOverlays = [];
let themeBaseOverlays = [];
const THEME_ADDITIONS_KEY = 'mapviewer.theme-additions.v1';
const themeAdditions = (() => {
  try {
    const saved = JSON.parse(localStorage.getItem(THEME_ADDITIONS_KEY) || '{}');
    return new Map(Object.entries(saved).map(([name, additions]) => [name, {
      layers: new Set(Array.isArray(additions.layers) ? additions.layers.filter(value => typeof value === 'string') : []),
      overlays: new Set(Array.isArray(additions.overlays) ? additions.overlays.filter(value => typeof value === 'string') : [])
    }]));
  } catch { return new Map(); }
})();
function saveThemeAdditions() {
  try {
    localStorage.setItem(THEME_ADDITIONS_KEY, JSON.stringify(Object.fromEntries(
      [...themeAdditions].map(([name, additions]) => [name, { layers: [...additions.layers], overlays: [...additions.overlays] }])
    )));
  } catch { toast('Theme additions could not be saved in this browser.'); }
}
function updateManualRemovalControls() {
  const additions = themeAdditions.get(activeThemeName);
  document.querySelectorAll('#legend .lgroup:not(.json-theme-legend)').forEach(group => {
    const removable = !activeThemeAll && additions && [...group.querySelector('.lgbody').children].some(item => {
      const key = item.dataset.orderKey || '';
      return key.startsWith('layer:') ? additions.layers.has(key.slice(6))
        : key.startsWith('overlay:') && additions.overlays.has(key.slice(8));
    });
    group.querySelector('.lremove').hidden = !removable;
  });
}
function removeManualGroupAdditions(group) {
  if (!activeThemeName || activeThemeAll) return;
  const additions = themeAdditions.get(activeThemeName);
  if (!additions) return;
  const items = [...group.querySelector('.lgbody').children].filter(item => {
    const key = item.dataset.orderKey || '';
    return key.startsWith('layer:') ? additions.layers.has(key.slice(6))
      : key.startsWith('overlay:') && additions.overlays.has(key.slice(8));
  });
  if (!items.length) return;
  const prompt = items.length === 1
    ? 'Are you sure you want to remove this added layer?'
    : 'Are you sure you want to remove these added layers?';
  if (!window.confirm(prompt)) return;
  items.forEach(item => {
    const key = item.dataset.orderKey;
    if (key.startsWith('layer:')) additions.layers.delete(key.slice(6));
    else additions.overlays.delete(key.slice(8));
  });
  themeLayers = [...new Set([...themeBaseLayers, ...additions.layers])];
  themeOverlays = [...new Set([...themeBaseOverlays, ...additions.overlays])];
  saveThemeAdditions();
  Object.entries(ctl.data).forEach(([id, control]) => {
    const inTheme = themeLayers.includes(id);
    control.theme(inTheme);
    control.el.hidden = !inTheme;
  });
  Object.entries(ctl.ov).forEach(([id, control]) => {
    const inTheme = themeOverlays.includes(id);
    control.theme(inTheme);
    control.el.hidden = !inTheme;
  });
  document.querySelectorAll('#legend .lgroup:not(.json-theme-legend)').forEach(section => {
    section.hidden = ![...section.querySelectorAll('.lgbody > *')].some(item => !item.hidden);
  });
  updateManualRemovalControls();
  populateSearchLayers();
  updateArcgisLegendInView();
}
const jsonThemeStates = new Map();
let activeJsonThemeId = null;
let activeJsonConfig = null;
let activeJsonThemeState = createJsonThemeState();
function jsonThemeMapIds(themeId = activeJsonThemeId) {
  const namespace = String(themeId || 'theme').replace(/[^a-z0-9_-]/gi, '-');
  const layer = `json-${namespace}-points`;
  const ids = {
    source: `json-${namespace}-source`,
    layer,
    lines: `json-${namespace}-lines`,
    polygons: `json-${namespace}-polygons`,
    clusters: `${layer}-clusters`,
    clusterCount: `${layer}-cluster-count`
  };
  ids.geometryLayers = [ids.layer, ids.lines, ids.polygons];
  ids.layers = [...ids.geometryLayers, ids.clusters, ids.clusterCount];
  return ids;
}
function resolveThemeGroup(name, seen = new Set()) {
  if (seen.has(name)) return { layers: [], overlays: [] };
  seen.add(name);
  const namedTheme = (CONFIG.themes || []).find(theme => theme.name === name);
  const custom = (CONFIG.groups || {})[name];   // CONFIG.groups: { name: { datasets, layers, overlays, groups } }
  const datasets = [...(namedTheme?.datasets || []), ...(custom?.datasets || [])];
  const overlays = (CONFIG.overlays || []).filter(overlay => overlay.group === name).map(overlay => overlay.id);
  const nested = (custom?.groups || []).map(g => resolveThemeGroup(g, seen));
  return {
    layers: [
      ...((window.LEGEND_GROUP_LAYERS || {})[name] || []),
      ...(namedTheme?.layers || []),
      ...(custom?.layers || []),
      ...datasets.flatMap(id => (window.DATASET_LAYERS || {})[id] || []),
      ...nested.flatMap(g => g.layers)
    ],
    overlays: [...overlays, ...(namedTheme?.overlays || []), ...(custom?.overlays || []), ...nested.flatMap(g => g.overlays)]
  };
}
///////////////////////////////////////////////////////////////////////////
// Applies configured theme visibility to vector layers, overlays, and JSON data.
///////////////////////////////////////////////////////////////////////////
function setupThemes() {
  const list = CONFIG.themes || [];
  $('themeBar').hidden = !list.length;
  if (!list.length) return;
  const sel = $('themeSel');
  sel.innerHTML = list.map((t, i) => `<option value="${i}">${esc(t.name)}</option>`).join('');
  const apply = i => {
    const t = list[i];
    activeThemeName = t.name;
    activeThemeAll = !t.layers && !t.overlays && !t.datasets && !t.groups && !t.jsonTheme;
    const additions = themeAdditions.get(t.name) || { layers: new Set(), overlays: new Set() };
    const groupMembers = (t.groups || []).map(name => resolveThemeGroup(name));
    const themeNames = [
      ...(t.layers || []),
      ...(t.datasets || []).flatMap(d => (window.DATASET_LAYERS || {})[d] || []),
      ...groupMembers.flatMap(group => group.layers)
    ];
    themeBaseOverlays = [...new Set([...(t.overlays || []), ...groupMembers.flatMap(group => group.overlays)])];
    themeOverlays = [...new Set([...themeBaseOverlays, ...additions.overlays])];
    themeBaseLayers = [...new Set(themeNames)];
    themeLayers = activeThemeAll ? null : [...new Set([...themeBaseLayers, ...additions.layers])];
    // Theme membership gates rendering without changing the user's checkbox state.
    Object.entries(ctl.data).forEach(([sl, o]) => {
      const inTheme = activeThemeAll || themeLayers.includes(sl);
      o.theme(inTheme); o.el.hidden = !inTheme;
    });
    Object.entries(ctl.ov).forEach(([id, o]) => {
      const inTheme = activeThemeAll || themeOverlays.includes(id);
      o.theme(inTheme); o.el.hidden = !inTheme;
    });
    additions.layers.forEach(id => ctl.data[id]?.set(true));
    additions.overlays.forEach(id => ctl.ov[id]?.set(true));
    document.querySelectorAll('#legend .lgroup:not(.json-theme-legend)').forEach(g => {   // hide headings with nothing left under them
      g.hidden = ![...g.querySelectorAll('.lgbody > *')].some(e => !e.hidden);
    });
    updateManualRemovalControls();
    clearResults();
    if (t.jsonTheme) activateJsonTheme(t).catch(error => toast(`Could not load ${t.name} config: ${error.message}`));
    else { setJsonThemeActive(false); setResults(!!t.showResults); }
    populateSearchLayers();   // search only offers the theme's layers
    updateArcgisLegendInView();
    syncMapLayerOrder();
  };
  sel.onchange = () => apply(sel.value);
  const firstJsonTheme = list.findIndex(theme => theme.jsonTheme && theme.jsonConfig);
  const hasSharedJsonState = !!location.hash && firstJsonTheme >= 0;
  const initialTheme = hasSharedJsonState ? firstJsonTheme : (CONFIG.defaultTheme || 0);
  sel.value = initialTheme;
  apply(sel.value);
}
function renderAddDataPicker() {
  const list = $('addDataList');
  list.replaceChildren();
  if (!activeThemeName) return;
  if (activeThemeAll) {
    const message = document.createElement('p');
    message.className = 'hint';
    message.textContent = 'This theme already includes all available data.';
    list.appendChild(message);
    $('addDataApply').disabled = true;
    return;
  }
  const groups = new Map();
  const add = (kind, id, control) => {
    const group = control.el.closest('.lgroup')?.dataset.groupName || 'Other';
    if (!groups.has(group)) groups.set(group, []);
    groups.get(group).push({ kind, id, label: kind === 'layer' ? id.replace(/_/g, ' ') : control.el.querySelector('.lname span')?.textContent || id });
  };
  Object.entries(ctl.data).forEach(([id, control]) => {
    if (!themeLayers.includes(id)) add('layer', id, control);
  });
  Object.entries(ctl.ov).forEach(([id, control]) => {
    if (!themeOverlays.includes(id)) add('overlay', id, control);
  });
  if (!groups.size) {
    const message = document.createElement('p');
    message.className = 'hint';
    message.textContent = 'No additional layers are available for this theme.';
    list.appendChild(message);
    $('addDataApply').disabled = true;
    return;
  }
  groups.forEach((items, name) => {
    const fieldset = document.createElement('fieldset');
    fieldset.className = 'add-data-group';
    const legend = document.createElement('legend');
    const groupLabel = document.createElement('label');
    const groupInput = document.createElement('input');
    groupInput.type = 'checkbox';
    groupInput.dataset.groupCheck = 'true';
    groupLabel.append(groupInput, document.createTextNode(name));
    legend.appendChild(groupLabel);
    fieldset.appendChild(legend);
    const itemInputs = [];
    items.forEach(item => {
      const label = document.createElement('label');
      const input = document.createElement('input');
      input.type = 'checkbox';
      input.dataset.kind = item.kind;
      input.dataset.id = item.id;
      const text = document.createElement('span');
      text.textContent = item.label;
      label.append(input, text);
      fieldset.appendChild(label);
      itemInputs.push(input);
    });
    const updateGroup = () => {
      const selected = itemInputs.filter(input => input.checked).length;
      groupInput.checked = selected === itemInputs.length;
      groupInput.indeterminate = selected > 0 && selected < itemInputs.length;
      $('addDataApply').disabled = !list.querySelector('input[data-kind]:checked');
    };
    groupInput.onchange = () => {
      itemInputs.forEach(input => { input.checked = groupInput.checked; });
      updateGroup();
    };
    itemInputs.forEach(input => input.onchange = updateGroup);
    list.appendChild(fieldset);
  });
}
function closeAddDataPanel() {
  $('addDataPanel').hidden = true;
  $('legend').hidden = false;
  syncAddDataButton();
}
function applySelectedThemeData() {
  if (!activeThemeName) return;
  const selected = [...$('addDataList').querySelectorAll('input[data-kind]:checked')];
  if (!selected.length) return;
  const additions = themeAdditions.get(activeThemeName) || { layers: new Set(), overlays: new Set() };
  selected.forEach(input => {
    const { kind, id } = input.dataset;
    if (kind === 'layer') {
      additions.layers.add(id);
      if (themeLayers && !themeLayers.includes(id)) themeLayers.push(id);
      const control = ctl.data[id];
      if (control) {
        control.theme(true);
        control.el.hidden = false;
        control.set(true);
      }
    } else if (kind === 'overlay') {
      additions.overlays.add(id);
      if (!themeOverlays.includes(id)) themeOverlays.push(id);
      const control = ctl.ov[id];
      if (control) {
        control.theme(true);
        control.el.hidden = false;
        control.set(true);
      }
    }
  });
  themeAdditions.set(activeThemeName, additions);
  saveThemeAdditions();
  document.querySelectorAll('#legend .lgroup:not(.json-theme-legend)').forEach(group => {
    group.hidden = ![...group.querySelectorAll('.lgbody > *')].some(item => !item.hidden);
  });
  updateManualRemovalControls();
  populateSearchLayers();
  updateArcgisLegendInView();
  syncMapLayerOrder();
  closeAddDataPanel();
}
function openAddDataPanel() {
  const wasLayersOpen = tool === 'legend';
  if (!wasLayersOpen) openTool('legend');
  if (wasLayersOpen && !$('addDataPanel').hidden) {
    closeAddDataPanel();
    return;
  }
  $('legend').hidden = true;
  $('addDataPanel').hidden = false;
  renderAddDataPicker();
  syncAddDataButton();
}
$('addDataBtn').onclick = openAddDataPanel;
$('addDataClose').onclick = closeAddDataPanel;
$('addDataApply').onclick = applySelectedThemeData;
async function activateJsonTheme(theme) {
  const config = await loadJsonThemeConfig(theme);
  const themeId = theme.jsonTheme;
  if (activeJsonThemeId !== themeId && activeJsonThemeState.active) setJsonThemeActive(false);
  activeJsonThemeId = themeId;
  activeJsonConfig = config;
  if (!jsonThemeStates.has(themeId)) {
    const state = createJsonThemeState();
    state.themeId = themeId;
    state.tab = config.tabs.find(tab => tab.isPrimary)?.key || config.tabs[0]?.key || null;
    jsonThemeStates.set(themeId, state);
  }
  activeJsonThemeState = jsonThemeStates.get(themeId);
  setJsonThemeActive(true);
  setResults(!!(theme.showResults ?? config.showResults));
}
function activeJsonThemeConfig() {
  return activeJsonConfig;
}
function jsonThemeRows(tabKey) {
  const rows = activeJsonThemeState.rows[tabKey] || [];
  const config = activeJsonThemeConfig();
  const primary = config.tabs.find(tab => tab.isPrimary);
  if (!config.geometryDataset || tabKey !== primary.key) return rows;
  return rows.map(row => {
    const tileProperties = activeJsonThemeState.geometryPropertiesById.get(String(row[config.linkField]));
    return tileProperties ? { ...tileProperties, ...row } : row;
  });
}
function jsonThemeColumns(tabKey) {
  const hidden = activeJsonThemeConfig().hiddenColumns || [];
  return [...new Set(jsonThemeRows(tabKey).flatMap(row => Object.keys(row)))].filter(field => !hidden.includes(field));
}
function jsonThemeColorExpression(config) {
  const value = ['to-number', ['get', config.depthField], -1];
  const classes = config.depthClasses || [];
  const expression = ['case'];
  classes.slice(0, -1).forEach(({ max, fill }, index) => {
    expression.push(index === 0 ? ['<=', value, max] : ['<', value, max], fill);
  });
  expression.push(classes.at(-1)?.fill || '#2166ac');
  return expression;
}
///////////////////////////////////////////////////////////////////////////
// Style layers of a deployment's `geometryDataset` that draw its `geometryLayer`.
///////////////////////////////////////////////////////////////////////////
function datasetGeometryLayerIds(config) {
  const sources = window.DATASET_SOURCES?.[config.geometryDataset] || [];
  return map.getStyle().layers
    .filter(l => sources.includes(l.source) && l['source-layer'] === config.geometryLayer)
    .map(l => l.id);
}
const geometryLayerFilters = new Map();   // layer id -> its original filter
const geometryLayerCursor = new Set();
// Limits the dataset's own layers to the rows left after bounds and filters; null restores them.
function setGeometryLayerFilter(config, ids) {
  datasetGeometryLayerIds(config).forEach(id => {
    if (!geometryLayerFilters.has(id)) geometryLayerFilters.set(id, map.getFilter(id) || null);
    const original = geometryLayerFilters.get(id);
    const field = config.geometryLinkField || config.linkField;
    const keep = ['in', ['get', field], ['literal', [...(ids || [])]]];
    map.setFilter(id, !ids ? original : original ? ['all', original, keep] : keep);
  });
}
function addJsonThemeMapLayers() {
  const ids = jsonThemeMapIds();
  const geometryConfig = activeJsonThemeConfig();
  if (geometryConfig.geometryDataset) {
    datasetGeometryLayerIds(geometryConfig).forEach(id => {
      if (geometryLayerCursor.has(id)) return;
      geometryLayerCursor.add(id);
      map.on('mouseenter', id, () => { if (activeJsonThemeState.active) map.getCanvas().style.cursor = 'pointer'; });
      map.on('mouseleave', id, () => { map.getCanvas().style.cursor = ''; });
    });
    return;
  }
  if (!map.getSource(ids.source)) {
    const config = activeJsonThemeConfig();
    const pointOnly = activeJsonThemeState.features.length > 0 &&
      activeJsonThemeState.features.every(feature => feature.geometry.type === 'Point');
    const clustered = config.clustering === true && pointOnly;
    map.addSource(ids.source, {
      type: 'geojson',
      data: { type: 'FeatureCollection', features: activeJsonThemeState.features },
      cluster: clustered,
      clusterRadius: 48,
      clusterMaxZoom: 13
    });
    map.addLayer({
      id: ids.polygons, type: 'fill', source: ids.source,
      paint: {
        'fill-color': jsonThemeColorExpression(config),
        'fill-opacity': config.fillOpacity ?? 0.35
      }
    });
    map.addLayer({
      id: ids.lines, type: 'line', source: ids.source,
      paint: {
        'line-color': jsonThemeColorExpression(config),
        'line-width': config.lineWidth ?? 2
      }
    });
    if (clustered) {
      map.addLayer({
        id: ids.clusters, type: 'circle', source: ids.source,
        filter: ['has', 'point_count'],
        paint: {
          'circle-color': '#286b68',
          'circle-radius': ['step', ['get', 'point_count'], 15, 25, 19, 100, 24],
          'circle-stroke-width': 1,
          'circle-stroke-color': '#ffffff'
        }
      });
      map.addLayer({
        id: ids.clusterCount, type: 'symbol', source: ids.source,
        filter: ['has', 'point_count'],
        layout: { 'text-field': ['get', 'point_count_abbreviated'], 'text-size': 12 },
        paint: { 'text-color': '#ffffff' }
      });
    }
    map.addLayer({
      id: ids.layer, type: 'circle', source: ids.source,
      ...(clustered ? { filter: ['!', ['has', 'point_count']] } : {}),
      paint: {
        'circle-color': jsonThemeColorExpression(config),
        'circle-radius': 5,
        'circle-stroke-width': 1,
        'circle-stroke-color': '#ffffff'
      }
    });
    ids.geometryLayers.forEach(id => {
      map.on('click', id, showJsonThemePopup);
      map.on('mouseenter', id, () => { map.getCanvas().style.cursor = 'pointer'; });
      map.on('mouseleave', id, () => { map.getCanvas().style.cursor = ''; });
    });
  }
  map.getSource(ids.source).setData({
    type: 'FeatureCollection', features: activeJsonThemeState.features
  });
  ids.layers.filter(id => map.getLayer(id)).forEach(id => registerLayerVisibility(id, true));
}
///////////////////////////////////////////////////////////////////////////
// Shows borehole details and filtered, expandable sibling results on map click.
///////////////////////////////////////////////////////////////////////////
function showJsonThemePopup(event) {
  let feature = event.features?.[0];
  if (!feature) return;
  const config = activeJsonThemeConfig();
  if (config.geometryDataset) {
    feature = activeJsonThemeState.featureById.get(String(feature.properties[config.geometryLinkField || config.linkField]));
    if (!feature) return;
  }
  const primary = config.tabs.find(tab => tab.isPrimary);
  const id = feature.properties[config.linkField];
  const clickedAt = [event.lngLat.lng, event.lngLat.lat];
  const content = document.createElement('div'); content.className = 'idwrap';
  const title = document.createElement('div'); title.className = 'idtitle';
  title.textContent = String(feature.properties[config.labelField] || id || 'Borehole');
  content.appendChild(title);

  const details = createJsonThemePopupSection('Borehole details', false, content);
  (config.popupFields || []).forEach(field => {
    if (field.type === 'zoomLink') {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'json-popup-zoom';
      button.textContent = field.label || 'Zoom to site';
      button.onclick = () => map.flyTo({ center: clickedAt, zoom: Math.max(map.getZoom(), 14) });
      details.records.appendChild(button);
      return;
    }
    const value = feature.properties[field.field];
    if (value == null || value === '') return;
    const line = document.createElement('div'); line.className = 'arow';
    const key = document.createElement('div'); key.className = 'akey'; key.textContent = field.label || field.field;
    const valueCell = jsonThemeCell(feature.properties, primary.key, field.field);
    valueCell.className = 'aval';
    if (field.bold) {
      const strong = document.createElement('strong');
      while (valueCell.firstChild) strong.appendChild(valueCell.firstChild);
      valueCell.appendChild(strong);
    }
    if (field.suffix) valueCell.append(` ${field.suffix.trim()}`);
    line.append(key, valueCell); details.records.appendChild(line);
  });
  content.appendChild(details.section);

  config.tabs.filter(tab => !tab.isPrimary).forEach(tab => {
    const rows = (activeJsonThemeState.visibleRows[tab.key] || []).filter(row =>
      String(row[config.linkField]) === String(id)
    );
    if (!rows.length) return;
    const section = createJsonThemePopupSection(`${tab.label} (${rows.length})`, true, content);
    section.section.classList.add('linked');
    let current = 0;
    let pageLabel = null;
    if (rows.length > 1) {
      const pager = document.createElement('div'); pager.className = 'pophead';
      const previous = document.createElement('button'); previous.type = 'button'; previous.className = 'nav';
      previous.textContent = '\u25c0'; previous.setAttribute('aria-label', `Previous ${tab.label} result`);
      pageLabel = document.createElement('span');
      const next = document.createElement('button'); next.type = 'button'; next.className = 'nav';
      next.textContent = '\u25b6'; next.setAttribute('aria-label', `Next ${tab.label} result`);
      previous.onclick = () => { current = (current + rows.length - 1) % rows.length; renderPage(); };
      next.onclick = () => { current = (current + 1) % rows.length; renderPage(); };
      pager.append(previous, pageLabel, next);
      section.body.appendChild(pager);
    }
    const renderPage = () => {
      const row = rows[current];
      section.records.replaceChildren();
      if (pageLabel) pageLabel.textContent = `${current + 1} of ${rows.length}`;
      Object.entries(row).filter(([field, value]) =>
        !config.hiddenColumns.includes(field) && value !== null && value !== undefined && value !== ''
      ).forEach(([field]) => {
        const line = document.createElement('div'); line.className = 'arow';
        const key = document.createElement('div'); key.className = 'akey'; key.textContent = field;
        const value = jsonThemeCell(row, tab.key, field); value.className = 'aval';
        line.append(key, value); section.records.appendChild(line);
      });
    };
    renderPage();
    content.appendChild(section.section);
  });
  new maplibregl.Popup({ maxWidth: '360px', className: 'idpop' })
    .setLngLat(clickedAt).setDOMContent(content).addTo(map);
}
function createJsonThemePopupSection(label, collapsed, accordionRoot) {
  const section = document.createElement('section');
  section.className = `idsec${collapsed ? ' collapsed' : ''}`;
  const heading = document.createElement('div'); heading.className = 'idhead';
  heading.tabIndex = 0; heading.setAttribute('role', 'button');
  heading.setAttribute('aria-expanded', String(!collapsed));
  const arrow = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); arrow.setAttribute('viewBox', '0 0 24 24');
  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path'); path.setAttribute('d', 'm6 9 6 6 6-6'); arrow.appendChild(path);
  const text = document.createElement('span'); text.className = 'idname'; text.textContent = label;
  heading.append(arrow, text);
  const body = document.createElement('div'); body.className = 'idbody';
  const records = document.createElement('div'); records.className = 'idtab';
  body.appendChild(records);
  const toggle = () => {
    const expand = section.classList.contains('collapsed');
    if (expand) accordionRoot.querySelectorAll('.idsec:not(.collapsed)').forEach(open => {
      if (open === section) return;
      open.classList.add('collapsed');
      open.querySelector('.idhead')?.setAttribute('aria-expanded', 'false');
    });
    section.classList.toggle('collapsed', !expand);
    heading.setAttribute('aria-expanded', String(expand));
  };
  heading.onclick = toggle;
  heading.onkeydown = event => {
    if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); toggle(); }
  };
  section.append(heading, body);
  return { section, body, records };
}
///////////////////////////////////////////////////////////////////////////
// Loads and joins the active JSON theme's configured datasets once.
///////////////////////////////////////////////////////////////////////////
function loadActiveJsonThemeData() {
  if (activeJsonThemeState.loaded) return Promise.resolve();
  if (activeJsonThemeState.loading) return activeJsonThemeState.loading;
  const config = activeJsonThemeConfig();
  activeJsonThemeState.loading = loadJsonThemeData(config).then(data => {
    activeJsonThemeState.rows = data.rows;
    activeJsonThemeState.errors = data.errors;
    activeJsonThemeState.deployments = data.deployments;
    activeJsonThemeState.deploymentLinks = data.deploymentLinks;
    const primary = config.tabs.find(tab => tab.isPrimary);
    activeJsonThemeState.features = config.geometryDataset ? [] : buildJsonFeatures(activeJsonThemeState.rows[primary.key], config, proj4);
    activeJsonThemeState.featureById = new Map(activeJsonThemeState.features.map(feature => [String(feature.id), feature]));
    activeJsonThemeState.loaded = true;
    if (config.geometryDataset) harvestDatasetGeometry();
    if (activeJsonThemeState.active) {
      addJsonThemeMapLayers();
      if (!activeJsonThemeState.stateRestored) {
        activeJsonThemeState.stateRestored = true;
        restoreJsonThemeState();
      }
      refreshJsonThemeResults();
    }
  }).catch(error => {
    activeJsonThemeState.loading = null;
    throw error;
  });
  return activeJsonThemeState.loading;
}
///////////////////////////////////////////////////////////////////////////
// For deployments with `geometryDataset`: joins loaded vector-tile features to the primary rows by link id.
// Returns true when new geometry was found.
///////////////////////////////////////////////////////////////////////////
function harvestDatasetGeometry() {
  const state = activeJsonThemeState;
  const config = activeJsonThemeConfig();
  if (!state.loaded || !config?.geometryDataset) return false;
  const primary = config.tabs.find(tab => tab.isPrimary);
  const rowsById = new Map((state.rows[primary.key] || []).map(row => [String(row[config.linkField]), row]));
  const tileField = config.geometryLinkField || config.linkField;
  let added = false;
  (window.DATASET_SOURCES?.[config.geometryDataset] || []).forEach(source => {
    if (!map.getSource(source)) return;
    map.querySourceFeatures(source, { sourceLayer: config.geometryLayer }).forEach(tileFeature => {
      const id = String(tileFeature.properties?.[tileField]);
      const row = rowsById.get(id);
      if (!row) return;
      const previous = state.geometryPropertiesById.get(id) || {};
      const tileProperties = { ...previous, ...tileFeature.properties };
      if (Object.keys(tileProperties).length !== Object.keys(previous).length ||
          Object.entries(tileProperties).some(([field, value]) => previous[field] !== value)) {
        state.geometryPropertiesById.set(id, tileProperties);
        added = true;
      }
      if (state.featureById.has(id)) return;
      const feature = { type: 'Feature', id, geometry: tileFeature.geometry, properties: { ...tileProperties, ...row } };
      state.featureById.set(id, feature);
      state.features.push(feature);
      added = true;
    });
  });
  return added;
}
map.on('idle', () => {
  if (activeJsonThemeState.active && harvestDatasetGeometry()) refreshJsonThemeResults();
});
///////////////////////////////////////////////////////////////////////////
// Activates the JSON theme map layer, results panel, and theme controls.
///////////////////////////////////////////////////////////////////////////
function setJsonThemeActive(active) {
  const wasActive = activeJsonThemeState.active;
  activeJsonThemeState.active = active;
  document.body.classList.toggle('json-theme', active);
  $('jsonControls').hidden = !active;
  $('jsonExcelBtn').hidden = !active;
  $('xlsxBtn').hidden = true;
  $('jsonCopyBtn').hidden = !active;
  $('jsonClearBtn').hidden = !active;
  $('csvBtn').hidden = active;
  $('boxBtn').disabled = active;
  $('runSearch').disabled = active;
  $('searchText').disabled = active;
  document.querySelector('#rail [data-tool="search"]').disabled = active;
  if (!activeJsonConfig) {
    $('jsonControls').hidden = true;
    $('jsonExcelBtn').hidden = true;
    $('jsonCopyBtn').hidden = true;
    $('jsonClearBtn').hidden = true;
    $('csvBtn').hidden = false;
    $('boxBtn').disabled = false;
    $('runSearch').disabled = false;
    $('searchText').disabled = false;
    document.querySelector('#rail [data-tool="search"]').disabled = false;
    return;
  }
  if (active && boxMode) setBox(false);
  if (active && tool === 'search') openTool('search');
  if (active && !wasActive && isMobile()) {
    toast('This view is not optimised for mobile devices. Please view it on a desktop.');
  }
  updateJsonThemeLegend(active);
  const ids = jsonThemeMapIds();
  setThemeVisibility(ids.layers, active);
  if (!active && activeJsonConfig.geometryDataset) setGeometryLayerFilter(activeJsonConfig, null);
  if (active) {
    if (!wasActive && !activeJsonThemeState.panelManuallySized) setPanelHeight(mainView.clientHeight * 0.35);
    if (activeJsonThemeState.loaded) refreshJsonThemeResults();
    else loadActiveJsonThemeData().catch(error => toast(`Could not load ${activeJsonThemeConfig().title || 'JSON theme'} data: ${error.message}`));
  } else if (wasActive) clearResults();
}
function updateJsonThemeLegend(active) {
  const config = activeJsonThemeConfig();
  const legend = $('legend');
  if (!activeJsonThemeState.depthGroup) {
    const themeNamespace = String(activeJsonThemeState.themeId || activeJsonThemeId).replace(/[^a-z0-9_-]/gi, '-');
    const depth = addGroup(legend, config.legendTitle || `${config.title} features`);
    depth.section = depth.body.closest('.lgroup');
    depth.section.id = `json-${themeNamespace}-depth-legend`;
    depth.section.classList.add('json-theme-legend');
    const ids = jsonThemeMapIds();
    ids.layers.forEach(id => depth.layerIds.add(id));
    (config.depthClasses || []).forEach(item => {
      const row = document.createElement('div'); row.className = 'json-legend-row';
      const swatch = document.createElement('span'); swatch.className = 'json-legend-swatch'; swatch.style.backgroundColor = item.fill;
      const label = document.createElement('span'); label.textContent = item.label;
      row.append(swatch, label); depth.body.appendChild(row);
    });
    const linked = addGroup(legend, config.filterGroupTitle || `${config.title} filters/results`);
    linked.section = linked.body.closest('.lgroup');
    linked.section.id = `json-${themeNamespace}-filters-legend`;
    linked.section.classList.add('json-theme-legend', 'json-link-filters');
    const controls = document.createElement('div'); controls.className = 'json-special-filters';
    controls.setAttribute('role', 'group'); controls.setAttribute('aria-label', 'Linked-data filters');
    linked.body.appendChild(controls);
    linked.onVisibilityChange = visible => { if (activeJsonThemeState.active) setResults(visible); };
    const eye = linked.section.querySelector('.lgeye');
    linked.setVisibility = visible => {
      activeJsonThemeState.linkedVisible = visible;
      eye.innerHTML = visible ? ICON_EYE : ICON_EYE_OFF;
      const label = `${visible ? 'Hide' : 'Show'} Quick Filters/Results Table`;
      eye.title = label;
      eye.setAttribute('aria-label', label);
      eye.setAttribute('aria-pressed', String(!visible));
      linked.section.classList.toggle('group-hidden', !visible);
      linked.onVisibilityChange(visible);
    };
    eye.onclick = () => linked.setVisibility(!activeJsonThemeState.linkedVisible);
    activeJsonThemeState.depthGroup = depth;
    activeJsonThemeState.linkedGroup = linked;
  }
  const { depthGroup, linkedGroup } = activeJsonThemeState;
  depthGroup.section.hidden = !active || !!config.geometryDataset;
  linkedGroup.section.hidden = !active;
  legend.prepend(depthGroup.section);
  legend.insertBefore(linkedGroup.section, depthGroup.section.nextSibling);
}
///////////////////////////////////////////////////////////////////////////
// Recomputes viewport-scoped filters and refreshes JSON theme map and tables.
///////////////////////////////////////////////////////////////////////////
function refreshJsonThemeResults(reopenPanel = false) {
  if (!activeJsonThemeState.active) return;
  const focused = document.activeElement?.dataset.jsonFilter;
  if (focused) {
    activeJsonThemeState.filterFocus = focused;
    activeJsonThemeState.filterSelection = {
      start: document.activeElement.selectionStart,
      end: document.activeElement.selectionEnd
    };
  }
  const config = activeJsonThemeConfig();
  const primary = config.tabs.find(tab => tab.isPrimary);
  const bounds = map.getBounds();
  const primaryRows = jsonThemeRows(primary.key);
  const bounded = primaryRows.filter(row => {
    const feature = activeJsonThemeState.featureById.get(String(row[config.linkField]));
    return feature && jsonGeometryIntersectsBounds(feature.geometry, bounds);
  });
  let boundedIds = new Set(bounded.map(row => row[config.linkField]).filter(Boolean));
  if (activeJsonThemeState.specialFilter) {
    const rows = activeJsonThemeState.rows[activeJsonThemeState.specialFilter] || [];
    const linked = new Set(rows.map(row => row[config.linkField]).filter(Boolean));
    boundedIds = new Set([...boundedIds].filter(id => linked.has(id)));
  }
  activeJsonThemeState.boundedIds = boundedIds;
  const primaryBase = filterJsonThemeRows(primary.key,
    bounded.filter(row => boundedIds.has(row[config.linkField])));
  let finalIds = new Set(primaryBase.map(row => row[config.linkField]).filter(Boolean));
  activeJsonThemeState.baseIds = new Set(finalIds);
  config.tabs.filter(tab => !tab.isPrimary).forEach(tab => {
    if (!hasJsonThemeFilters(tab.key)) return;
    const filtered = filterJsonThemeRows(tab.key,
      (activeJsonThemeState.rows[tab.key] || []).filter(row => finalIds.has(row[config.linkField])));
    const matches = new Set(filtered.map(row => row[config.linkField]).filter(Boolean));
    finalIds = new Set([...finalIds].filter(id => matches.has(id)));
  });
  activeJsonThemeState.finalIds = finalIds;
  activeJsonThemeState.visibleRows = {};
  config.tabs.forEach(tab => {
    const scope = tab.isPrimary ? primaryBase : (activeJsonThemeState.rows[tab.key] || []).filter(row => finalIds.has(row[config.linkField]));
    activeJsonThemeState.visibleRows[tab.key] = filterJsonThemeRows(tab.key, scope)
      .filter(row => finalIds.has(row[config.linkField]));
  });
  const visibleFeatures = activeJsonThemeState.features.filter(feature => finalIds.has(feature.properties[config.linkField]));
  const mapIds = jsonThemeMapIds();
  if (config.geometryDataset) setGeometryLayerFilter(config, finalIds);
  if (map.getSource(mapIds.source)) {
    map.getSource(mapIds.source).setData({ type: 'FeatureCollection', features: visibleFeatures });
  }
  renderJsonThemeControls();
  renderJsonThemeTabs();
  renderJsonThemeTable();
  $('count').textContent = `${finalIds.size} items in view`;
  if (reopenPanel && !resultsOn) setResults(true);
}
map.on('moveend', () => {
  if (activeJsonThemeState.active && activeJsonThemeState.loaded) refreshJsonThemeResults();
});
function jsonThemeFilterBucket(kind, tabKey) {
  const bucket = activeJsonThemeState.filters[kind];
  return bucket[tabKey] || (bucket[tabKey] = {});
}
function jsonThemeSpecialFilterControl() {
  return activeJsonThemeState.linkedGroup?.body.querySelector('.json-special-filters');
}
function hasJsonThemeFilters(tabKey, exceptField = null) {
  return hasJsonFilters(activeJsonThemeState.filters, tabKey, exceptField);
}
function filterJsonThemeRows(tabKey, rows, exceptField = null) {
  return filterJsonRows(rows, tabKey, activeJsonThemeState.filters, activeJsonThemeConfig(), exceptField);
}
function jsonThemeDropdownRows(tabKey, field) {
  const config = activeJsonThemeConfig();
  const primary = config.tabs.find(tab => tab.isPrimary);
  const primaryRows = jsonThemeRows(primary.key).filter(row => activeJsonThemeState.boundedIds.has(row[config.linkField]));
  let ids = new Set(filterJsonThemeRows(primary.key, primaryRows, tabKey === primary.key ? field : null)
    .map(row => row[config.linkField]).filter(Boolean));
  config.tabs.filter(tab => !tab.isPrimary && tab.key !== tabKey && hasJsonThemeFilters(tab.key)).forEach(tab => {
    const filtered = filterJsonThemeRows(tab.key,
      (activeJsonThemeState.rows[tab.key] || []).filter(row => ids.has(row[config.linkField])));
    const next = new Set(filtered.map(row => row[config.linkField]).filter(Boolean));
    ids = new Set([...ids].filter(id => next.has(id)));
  });
  const sourceTab = config.tabs.find(tab => tab.key === tabKey);
  const scope = sourceTab.isPrimary
    ? primaryRows.filter(row => ids.has(row[config.linkField]))
    : jsonThemeRows(tabKey).filter(row => ids.has(row[config.linkField]));
  return filterJsonThemeRows(tabKey, scope, field);
}
function renderJsonThemeControls() {
  const config = activeJsonThemeConfig();
  const special = jsonThemeSpecialFilterControl();
  if (!special) return;
  special.replaceChildren();
  const specialSelect = document.createElement('select');
  specialSelect.className = 'theme-select';
  specialSelect.setAttribute('aria-label', 'Filter items by linked data');
  const allOption = document.createElement('option'); allOption.value = ''; allOption.textContent = 'Filter by';
  specialSelect.appendChild(allOption);
  config.tabs.filter(tab => tab.specialFilter).forEach(tab => {
    const option = document.createElement('option'); option.value = tab.key; option.textContent = `Items with ${tab.specialFilter}`;
    specialSelect.appendChild(option);
  });
  specialSelect.value = activeJsonThemeState.specialFilter || '';
  specialSelect.onchange = () => { activeJsonThemeState.specialFilter = specialSelect.value || null; refreshJsonThemeResults(true); };
  special.appendChild(specialSelect);
  const pills = $('jsonActiveFilters');
  pills.replaceChildren();
  if (activeJsonThemeState.specialFilter) {
    const tab = config.tabs.find(item => item.key === activeJsonThemeState.specialFilter);
    appendJsonThemeFilterPill(pills, `With ${tab.specialFilter}`, () => {
      activeJsonThemeState.specialFilter = null; refreshJsonThemeResults(true);
    });
  }
  config.tabs.forEach(tab => {
    const state = activeJsonThemeState.filters;
    Object.entries(state.text[tab.key] || {}).forEach(([field, value]) => value && appendJsonThemeFilterPill(pills, `${tab.label}: ${field} ${value}`, () => {
      delete state.text[tab.key][field]; refreshJsonThemeResults(true);
    }));
    Object.entries(state.range[tab.key] || {}).forEach(([field, value]) => value !== '' && appendJsonThemeFilterPill(pills, `${tab.label}: ${field} ${state.operators[tab.key]?.[field] === 'lte' ? '<=' : '>='} ${value}`, () => {
      delete state.range[tab.key][field]; refreshJsonThemeResults(true);
    }));
    Object.entries(state.dropdown[tab.key] || {}).forEach(([field, values]) => values?.length && appendJsonThemeFilterPill(pills, `${tab.label}: ${field} (${values.length})`, () => {
      delete state.dropdown[tab.key][field]; refreshJsonThemeResults(true);
    }));
  });
  Object.entries(activeJsonThemeState.errors).forEach(([key, message]) => {
    const tab = config.tabs.find(item => item.key === key);
    const error = document.createElement('span');
    error.className = 'json-error';
    error.textContent = `${tab?.label || key}: ${message}`;
    pills.appendChild(error);
  });
}
function appendJsonThemeFilterPill(parent, label, clear) {
  const pill = document.createElement('span');
  pill.className = 'json-pill';
  pill.append(document.createTextNode(label));
  const button = document.createElement('button');
  button.type = 'button'; button.textContent = 'x'; button.setAttribute('aria-label', `Clear ${label}`);
  button.onclick = clear;
  pill.appendChild(button); parent.appendChild(pill);
}
function renderJsonThemeColumnFilters() {
  const config = activeJsonThemeConfig();
  const tab = config.tabs.find(item => item.key === activeJsonThemeState.tab) || config.tabs[0];
  const controlsByField = new Map();
  jsonThemeColumns(tab.key).forEach(field => {
    const control = document.createElement('div');
    control.className = 'json-filter-control';
    control.setAttribute('role', 'group');
    control.setAttribute('aria-label', `Filter by ${field}`);
    if (Object.hasOwn(config.rangeFilterColumns, field)) {
      const controls = document.createElement('span'); controls.className = 'range-control';
      const operator = document.createElement('button'); operator.type = 'button'; operator.className = 'range-operator';
      const operators = jsonThemeFilterBucket('operators', tab.key);
      operator.textContent = operators[field] === 'lte' ? '<=' : '>=';
      operator.title = `Toggle ${field} minimum or maximum`;
      operator.setAttribute('aria-label', `Toggle ${field} comparison`);
      operator.onclick = () => {
        operators[field] = operators[field] === 'lte' ? 'gte' : 'lte';
          refreshJsonThemeResults(true);
      };
      const input = document.createElement('input'); input.type = 'number'; input.value = jsonThemeFilterBucket('range', tab.key)[field] || '';
      input.dataset.jsonFilter = `${tab.key}:${field}:range`;
      input.setAttribute('aria-label', `Filter ${field}`);
      input.oninput = () => { jsonThemeFilterBucket('range', tab.key)[field] = input.value; refreshJsonThemeResults(true); };
      controls.append(operator, input); control.appendChild(controls);
    } else if ((config.dropdownColumns || []).includes(field)) {
      control.appendChild(buildJsonThemeDropdown(tab.key, field));
    } else {
      const input = document.createElement('input'); input.type = 'search'; input.value = jsonThemeFilterBucket('text', tab.key)[field] || '';
      input.dataset.jsonFilter = `${tab.key}:${field}:text`;
      input.setAttribute('aria-label', `Filter ${field}`);
      input.oninput = () => { jsonThemeFilterBucket('text', tab.key)[field] = input.value; refreshJsonThemeResults(true); };
      control.appendChild(input);
    }
    controlsByField.set(field, control);
  });
  return controlsByField;
}
function positionOpenJsonThemeDropdown() {
  const key = activeJsonThemeState.openDropdown;
  if (!key) return;
  const trigger = [...$('tablewrap').querySelectorAll('.json-dropdown-trigger')]
    .find(button => button.dataset.jsonFilter === `${key}:trigger`);
  const panel = trigger?.nextElementSibling;
  if (!trigger || !panel) return;
  const bounds = trigger.getBoundingClientRect();
  const width = Math.min(280, innerWidth - 24);
  const height = panel.getBoundingClientRect().height;
  panel.style.left = `${Math.max(8, Math.min(bounds.left, innerWidth - width - 8))}px`;
  const below = bounds.bottom + 4;
  const top = below + height <= innerHeight - 8 ? below : bounds.top - height - 4;
  panel.style.top = `${Math.max(8, top)}px`;
}
///////////////////////////////////////////////////////////////////////////
// Renders dataset tabs with counts and their configured help controls.
///////////////////////////////////////////////////////////////////////////
function renderJsonThemeTabs() {
  const config = activeJsonThemeConfig();
  closeJsonThemeHelp();
  const tabs = $('tabs'); tabs.replaceChildren();
  const available = config.tabs.filter(tab => !activeJsonThemeState.hiddenTabs.has(tab.key));
  if (!available.some(tab => tab.key === activeJsonThemeState.tab)) activeJsonThemeState.tab = available[0]?.key || config.tabs[0].key;
  available.forEach(tab => {
    const rows = activeJsonThemeState.visibleRows[tab.key] || [];
    const group = document.createElement('span'); group.className = 'json-tab-group';
    const button = document.createElement('button');
    button.type = 'button'; button.className = `tab${activeJsonThemeState.tab === tab.key ? ' on' : ''}`;
    button.textContent = `${tab.label} (${rows.length})`;
    button.onclick = () => { activeJsonThemeState.tab = tab.key; renderJsonThemeControls(); renderJsonThemeTabs(); renderJsonThemeTable(); };
    group.appendChild(button);
    if (tab.help?.content) {
      const help = document.createElement('button');
      help.type = 'button'; help.className = 'json-tab-help'; help.textContent = '?';
      help.title = tab.help.title || `Help for ${tab.label}`;
      help.setAttribute('aria-label', help.title);
      help.setAttribute('aria-haspopup', 'dialog');
      help.setAttribute('aria-expanded', 'false');
      help.onpointerenter = () => showJsonThemeHelp(tab, help);
      help.onpointerleave = scheduleJsonThemeHelpClose;
      help.onfocus = () => showJsonThemeHelp(tab, help);
      help.onblur = scheduleJsonThemeHelpClose;
      help.onclick = event => {
        event.stopPropagation();
        if (jsonThemeHelpPopover?.trigger === help && jsonThemeHelpPopover.pinned) closeJsonThemeHelp();
        else showJsonThemeHelp(tab, help, true);
      };
      help.onkeydown = event => {
        if (event.key === 'Escape') { event.preventDefault(); closeJsonThemeHelp(true); }
      };
      group.appendChild(help);
    }
    if (tab.hideable) {
      const hide = document.createElement('button'); hide.type = 'button'; hide.className = 'json-tab-hide';
      hide.textContent = 'x'; hide.title = `Hide ${tab.label}`; hide.setAttribute('aria-label', `Hide ${tab.label}`);
      hide.onclick = () => {
        activeJsonThemeState.hiddenTabs.add(tab.key);
        if (activeJsonThemeState.tab === tab.key) activeJsonThemeState.tab = available.find(item => item.key !== tab.key)?.key || config.tabs[0].key;
        renderJsonThemeControls(); renderJsonThemeTabs(); renderJsonThemeTable();
      };
      group.appendChild(hide);
    }
    tabs.appendChild(group);
  });
  if (activeJsonThemeState.hiddenTabs.size) {
    const show = document.createElement('select'); show.setAttribute('aria-label', 'Restore hidden dataset tab');
    const prompt = document.createElement('option'); prompt.value = ''; prompt.textContent = 'Show hidden tab'; show.appendChild(prompt);
    config.tabs.filter(tab => activeJsonThemeState.hiddenTabs.has(tab.key)).forEach(tab => {
      const option = document.createElement('option'); option.value = tab.key; option.textContent = tab.label; show.appendChild(option);
    });
    show.onchange = () => {
      if (show.value) activeJsonThemeState.hiddenTabs.delete(show.value);
      renderJsonThemeTabs();
    };
    tabs.appendChild(show);
  }
}
function buildJsonThemeDropdown(tabKey, field) {
  const key = `${tabKey}:${field}`;
  const wrapper = document.createElement('div'); wrapper.className = 'json-dropdown-wrapper';
  wrapper.addEventListener('click', event => event.stopPropagation());
  const selected = jsonThemeFilterBucket('dropdown', tabKey)[field] || [];
  const trigger = document.createElement('button');
  trigger.type = 'button'; trigger.className = 'json-dropdown-trigger';
  trigger.dataset.jsonFilter = `${key}:trigger`;
  trigger.setAttribute('aria-haspopup', 'listbox');
  trigger.setAttribute('aria-expanded', String(activeJsonThemeState.openDropdown === key));
  trigger.textContent = selected.length ? `${selected.length} selected` : 'Any value';
  trigger.title = selected.length ? selected.join(', ') : `Filter ${field}`;
  const panel = document.createElement('div'); panel.className = 'json-dropdown-panel';
  panel.hidden = activeJsonThemeState.openDropdown !== key;
  panel.setAttribute('role', 'group'); panel.setAttribute('aria-label', `${field} values`);
  const search = document.createElement('input'); search.type = 'search'; search.className = 'json-dropdown-search';
  search.placeholder = 'Search values'; search.setAttribute('aria-label', `Search ${field} values`);
  search.dataset.jsonFilter = `${key}:search`;
  search.value = activeJsonThemeState.dropdownSearch[key] || '';
  const actions = document.createElement('div'); actions.className = 'json-dropdown-actions';
  const options = [...new Set(jsonThemeDropdownRows(tabKey, field)
    .map(row => row[field]).filter(value => value != null).map(String).concat(selected))]
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));
  const optionList = document.createElement('div'); optionList.className = 'json-dropdown-options';
  optionList.setAttribute('role', 'listbox'); optionList.setAttribute('aria-multiselectable', 'true');
  optionList.setAttribute('aria-label', `${field} options`);
  const updateSearch = () => {
    const term = search.value.trim().toLocaleLowerCase();
    activeJsonThemeState.dropdownSearch[key] = search.value;
    optionList.querySelectorAll('.json-dropdown-option').forEach(option => {
      option.hidden = !option.dataset.optionValue.toLocaleLowerCase().includes(term);
    });
  };
  search.oninput = updateSearch;
  const addAction = (text, handler) => {
    const button = document.createElement('button'); button.type = 'button'; button.textContent = text;
    button.onclick = handler; actions.appendChild(button);
  };
  addAction('Select all', () => {
    jsonThemeFilterBucket('dropdown', tabKey)[field] = [...options];
    refreshJsonThemeResults(true);
  });
  addAction('Clear', () => {
    delete jsonThemeFilterBucket('dropdown', tabKey)[field];
    refreshJsonThemeResults(true);
  });
  options.forEach(value => {
    const option = document.createElement('label'); option.className = 'json-dropdown-option';
    option.dataset.optionValue = value;
    const checkbox = document.createElement('input'); checkbox.type = 'checkbox'; checkbox.checked = selected.includes(value);
    checkbox.dataset.jsonFilter = `${key}:option:${value}`;
    checkbox.onchange = () => {
      const next = new Set(jsonThemeFilterBucket('dropdown', tabKey)[field] || []);
      if (checkbox.checked) next.add(value); else next.delete(value);
      jsonThemeFilterBucket('dropdown', tabKey)[field] = [...next];
      refreshJsonThemeResults(true);
    };
    const text = document.createElement('span'); text.textContent = value;
    option.append(checkbox, text); optionList.appendChild(option);
  });
  if (!options.length) { const empty = document.createElement('span'); empty.className = 'json-dropdown-empty'; empty.textContent = 'No values in this view'; optionList.appendChild(empty); }
  panel.append(search, actions, optionList);
  trigger.onclick = () => {
    const opening = activeJsonThemeState.openDropdown !== key;
    activeJsonThemeState.openDropdown = activeJsonThemeState.openDropdown === key ? null : key;
    renderJsonThemeTable();
    if (opening) requestAnimationFrame(() => $('tablewrap').querySelector('.json-dropdown-search')?.focus());
  };
  wrapper.append(trigger, panel);
  return wrapper;
}
document.addEventListener('pointerdown', event => {
  if (activeJsonThemeState.openDropdown && !event.target.closest('.json-dropdown-wrapper')) {
    activeJsonThemeState.openDropdown = null;
    document.querySelectorAll('.json-dropdown-panel:not([hidden])').forEach(panel => { panel.hidden = true; });
    document.querySelectorAll('.json-dropdown-trigger[aria-expanded="true"]').forEach(button => button.setAttribute('aria-expanded', 'false'));
  }
});
function jsonThemeSafeUrl(value) {
  try {
    const url = new URL(value, location.href);
    return ['http:', 'https:', 'ftp:'].includes(url.protocol) ? url.href : null;
  } catch { return null; }
}
function jsonThemeCell(row, tabKey, field) {
  const config = activeJsonThemeConfig();
  const value = row[field];
  const cellEl = document.createElement('td');
  if (value == null || value === '') { cellEl.textContent = '\u2014'; return cellEl; }
  const rawUrl = typeof value === 'string' && /^(https?|ftp):\/\//i.test(value) ? jsonThemeSafeUrl(value) : null;
  if (rawUrl) {
    const link = document.createElement('a'); link.href = rawUrl; link.textContent = config.urlFields?.[field] || 'View';
    link.target = '_blank'; link.rel = 'noopener noreferrer'; cellEl.appendChild(link);
  } else {
    cellEl.textContent = typeof value === 'number' && !config.nonNumericColumns?.includes(field) ? value.toFixed(2) : String(value);
  }
  cellEl.title = String(value);
  const computed = (config.computedLinks || []).find(definition => definition.field === field);
  if (computed) {
    const base = computed.baseKey ? config.urlBases?.[computed.baseKey] : computed.prefix;
    const url = jsonThemeSafeUrl(`${base || ''}${encodeURIComponent(value)}${computed.suffix || ''}`);
    if (url) {
      const link = document.createElement('a'); link.href = url; link.target = '_blank'; link.rel = 'noopener noreferrer';
      link.className = 'computed-link-icon'; link.title = computed.title || 'Open link'; link.textContent = '\u2197';
      cellEl.appendChild(link);
    }
  }
  activeJsonThemeState.deploymentLinks.filter(link =>
    (link.sourceDeployment || config.deploymentId) === config.deploymentId &&
    link.sourceTab === tabKey && link.sourceColumn === field
  ).forEach(link => {
    const target = activeJsonThemeState.deployments.find(item => item.id === link.targetDeployment);
    const targetUrl = target?.url || link.targetUrl;
    if (!targetUrl) return;
    const state = link.filterType === 'dropdown'
      ? { dropdown: { [link.targetTab]: { [link.targetColumn]: [String(value)] } } }
      : { search: { [link.targetTab]: { [link.targetColumn]: String(value) } } };
    const safeTarget = jsonThemeSafeUrl(targetUrl);
    if (!safeTarget) return;
    const targetLink = document.createElement('a');
    targetLink.href = `${safeTarget.replace(/\/$/, '')}#${btoa(unescape(encodeURIComponent(JSON.stringify(state))))}`;
    targetLink.target = '_blank'; targetLink.rel = 'noopener noreferrer'; targetLink.className = 'deployment-link-icon';
    targetLink.title = `Search in ${target?.title || link.targetTitle || 'linked deployment'}`;
    targetLink.textContent = '\u2197'; cellEl.appendChild(targetLink);
  });
  return cellEl;
}
///////////////////////////////////////////////////////////////////////////
// Builds the active dataset table, aligned filters, and sortable headers.
///////////////////////////////////////////////////////////////////////////
function renderJsonThemeTable() {
  const config = activeJsonThemeConfig();
  const tab = config.tabs.find(item => item.key === activeJsonThemeState.tab) || config.tabs[0];
  const rows = [...(activeJsonThemeState.visibleRows[tab.key] || [])];
  const sort = activeJsonThemeState.sort[tab.key];
  const focusedFilter = activeJsonThemeState.filterFocus || document.activeElement?.dataset.jsonFilter;
  const selection = activeJsonThemeState.filterSelection;
  if (sort) rows.sort((a, b) => String(a[sort.field] ?? '').localeCompare(String(b[sort.field] ?? ''), undefined, { numeric: true }) * (sort.direction === 'desc' ? -1 : 1));
  const columns = jsonThemeColumns(tab.key);
  const filterControls = renderJsonThemeColumnFilters();
  const headerRow = document.createElement('tr');
  const zoomHead = document.createElement('th'); zoomHead.textContent = 'Zoom'; zoomHead.title = 'Zoom to record'; headerRow.appendChild(zoomHead);
  columns.forEach(field => {
    const th = document.createElement('th');
    th.textContent = field;
    th.dataset.sortable = 'true';
    th.tabIndex = 0;
    th.setAttribute('aria-sort', sort?.field === field ? (sort.direction === 'asc' ? 'ascending' : 'descending') : 'none');
    th.title = `Sort by ${field}`;
    const sortByField = () => {
      const previous = activeJsonThemeState.sort[tab.key];
      activeJsonThemeState.sort[tab.key] = { field, direction: previous?.field === field && previous.direction === 'asc' ? 'desc' : 'asc' };
      renderJsonThemeTable();
    };
    th.onclick = sortByField;
    th.onkeydown = event => {
      if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); sortByField(); }
    };
    headerRow.appendChild(th);
  });
  const filterRow = document.createElement('tr'); filterRow.className = 'json-filter-row';
  filterRow.appendChild(document.createElement('th'));
  columns.forEach(field => {
    const th = document.createElement('th');
    const control = filterControls.get(field);
    if (control) th.appendChild(control);
    filterRow.appendChild(th);
  });
  const wrap = $('tablewrap'); wrap.replaceChildren();
  const table = document.createElement('table');
  const head = table.createTHead(); head.append(headerRow, filterRow);
  table.createTBody(); wrap.appendChild(table);
  positionOpenJsonThemeDropdown();
  if (focusedFilter) {
    const replacement = [...wrap.querySelectorAll('[data-json-filter]')]
      .find(element => element.dataset.jsonFilter === focusedFilter);
    replacement?.focus();
    if (replacement instanceof HTMLInputElement && replacement.type === 'search' && selection?.start != null) {
      replacement.setSelectionRange(selection.start, selection.end);
    }
  }
  activeJsonThemeState.filterFocus = null;
  activeJsonThemeState.filterSelection = null;
  activeJsonThemeState.visibleRows[`${tab.key}:sorted`] = rows;
  wrap.onscroll = () => renderJsonThemeVirtualSlice(tab.key, columns);
  renderJsonThemeVirtualSlice(tab.key, columns);
}
function renderJsonThemeVirtualSlice(tabKey, columns) {
  const rows = activeJsonThemeState.visibleRows[`${tabKey}:sorted`] || [];
  const wrap = $('tablewrap');
  const body = wrap.querySelector('tbody');
  if (!body) return;
  const rowHeight = 32;
  const first = Math.max(0, Math.floor(wrap.scrollTop / rowHeight) - 8);
  const count = Math.ceil(wrap.clientHeight / rowHeight) + 16;
  const last = Math.min(rows.length, first + count);
  body.replaceChildren();
  if (first) {
    const spacer = body.insertRow(); const cell = spacer.insertCell(); cell.colSpan = columns.length + 1; cell.style.height = `${first * rowHeight}px`; cell.style.padding = '0';
  }
  rows.slice(first, last).forEach(row => {
    const tr = body.insertRow();
    tr.title = 'Click to zoom to this record';
    tr.onclick = event => {
      if (event.target.closest('a, button')) return;
      const config = activeJsonThemeConfig();
      const feature = activeJsonThemeState.featureById.get(String(row[config.linkField]));
      const center = feature && jsonGeometryCenter(feature.geometry);
      if (center) map.flyTo({ center, zoom: Math.max(map.getZoom(), 14) });
    };
    const action = tr.insertCell();
    const config = activeJsonThemeConfig();
    const zoom = document.createElement('button'); zoom.type = 'button'; zoom.className = 'json-row-zoom';
    zoom.title = `Zoom to ${row[config.labelField] || row[config.linkField]}`;
    zoom.setAttribute('aria-label', zoom.title);
    zoom.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.8" cy="10.8" r="6.4"></circle><path d="m16 16 4.5 4.5"></path></svg>';
    zoom.onclick = () => {
      const feature = activeJsonThemeState.featureById.get(String(row[config.linkField]));
      const center = feature && jsonGeometryCenter(feature.geometry);
      if (center) map.flyTo({ center, zoom: Math.max(map.getZoom(), 14) });
    };
    action.appendChild(zoom);
    columns.forEach(field => tr.appendChild(jsonThemeCell(row, tabKey, field)));
  });
  if (last < rows.length) {
    const spacer = body.insertRow(); const cell = spacer.insertCell(); cell.colSpan = columns.length + 1; cell.style.height = `${(rows.length - last) * rowHeight}px`; cell.style.padding = '0';
  }
}
let jsonThemeHelpPopover = null;
function jsonThemeHelpContent(tab) {
  const content = document.createElement('div');
  content.className = 'json-help-content';
  const parsed = new DOMParser().parseFromString(tab.help?.content || '', 'text/html');
  const allowed = new Set(['P', 'UL', 'OL', 'LI', 'STRONG', 'EM', 'A', 'BR']);
  const copy = (source, target) => [...source.childNodes].forEach(node => {
    if (node.nodeType === Node.TEXT_NODE) target.appendChild(document.createTextNode(node.textContent));
    else if (allowed.has(node.nodeName)) {
      const element = document.createElement(node.nodeName.toLowerCase());
      if (node.nodeName === 'A') {
        const href = jsonThemeSafeUrl(node.getAttribute('href'));
        if (href) { element.href = href; element.target = '_blank'; element.rel = 'noopener noreferrer'; }
      }
      copy(node, element); target.appendChild(element);
    } else copy(node, target);
  });
  copy(parsed.body, content);
  return content;
}
function positionJsonThemeHelpPopover() {
  const state = jsonThemeHelpPopover;
  if (!state) return;
  const bounds = state.trigger.getBoundingClientRect();
  const popover = state.element;
  const width = Math.min(320, innerWidth - 24);
  const height = popover.getBoundingClientRect().height;
  popover.style.left = `${Math.max(12, Math.min(bounds.left, innerWidth - width - 12))}px`;
  const below = bounds.bottom + 8;
  popover.style.top = `${Math.max(12, below + height <= innerHeight - 12 ? below : bounds.top - height - 8)}px`;
}
function showJsonThemeHelp(tab, trigger, pin = false) {
  if (jsonThemeHelpPopover?.trigger === trigger) {
    clearTimeout(jsonThemeHelpPopover.closeTimer);
    jsonThemeHelpPopover.pinned ||= pin;
    return;
  }
  closeJsonThemeHelp();
  const element = document.createElement('section');
  element.className = 'json-help-popover';
  element.setAttribute('role', 'dialog');
  element.setAttribute('aria-label', tab.help?.title || tab.label);
  element.id = 'jsonThemeHelpPopover';
  const header = document.createElement('header');
  const title = document.createElement('strong'); title.textContent = tab.help?.title || tab.label;
  const close = document.createElement('button'); close.type = 'button'; close.className = 'json-help-close';
  close.textContent = '×'; close.setAttribute('aria-label', 'Close help');
  close.onclick = () => closeJsonThemeHelp(true);
  header.append(title, close);
  element.append(header, jsonThemeHelpContent(tab));
  element.onpointerenter = () => clearTimeout(jsonThemeHelpPopover?.closeTimer);
  element.onpointerleave = scheduleJsonThemeHelpClose;
  element.onfocusin = () => clearTimeout(jsonThemeHelpPopover?.closeTimer);
  element.onfocusout = event => {
    if (!element.contains(event.relatedTarget)) scheduleJsonThemeHelpClose();
  };
  document.body.appendChild(element);
  jsonThemeHelpPopover = { element, trigger, pinned: pin, closeTimer: null };
  trigger.setAttribute('aria-expanded', 'true');
  trigger.setAttribute('aria-controls', element.id);
  positionJsonThemeHelpPopover();
}
function scheduleJsonThemeHelpClose() {
  const state = jsonThemeHelpPopover;
  if (!state || state.pinned) return;
  clearTimeout(state.closeTimer);
  state.closeTimer = setTimeout(() => closeJsonThemeHelp(), 180);
}
function closeJsonThemeHelp(returnFocus = false) {
  const state = jsonThemeHelpPopover;
  if (!state) return;
  clearTimeout(state.closeTimer);
  state.trigger.setAttribute('aria-expanded', 'false');
  state.trigger.removeAttribute('aria-controls');
  state.element.remove();
  jsonThemeHelpPopover = null;
  if (returnFocus) state.trigger.focus();
}
document.addEventListener('pointerdown', event => {
  if (jsonThemeHelpPopover && !jsonThemeHelpPopover.element.contains(event.target) &&
      !jsonThemeHelpPopover.trigger.contains(event.target)) closeJsonThemeHelp();
});
function clearJsonThemeFilters() {
  activeJsonThemeState.filters.text = {};
  activeJsonThemeState.filters.range = {};
  activeJsonThemeState.filters.dropdown = {};
  activeJsonThemeState.specialFilter = null;
  activeJsonThemeState.sort = {};
  history.replaceState(null, '', `${location.pathname}${location.search}`);
  refreshJsonThemeResults(true);
}
function jsonThemeShareState() {
  const center = map.getCenter();
  const range = {};
  Object.entries(activeJsonThemeState.filters.range).forEach(([tabKey, fields]) => {
    range[tabKey] = {};
    Object.entries(fields).forEach(([field, value]) => {
      if (value !== '' && Number.isFinite(Number(value))) {
        range[tabKey][field] = {
          value: Number(value),
          operator: activeJsonThemeState.filters.operators[tabKey]?.[field] || activeJsonThemeConfig().rangeFilterColumns[field]
        };
      }
    });
    if (!Object.keys(range[tabKey]).length) delete range[tabKey];
  });
  return {
    search: activeJsonThemeState.filters.text,
    range,
    dropdown: activeJsonThemeState.filters.dropdown,
    special: activeJsonThemeState.specialFilter,
    hiddenTabs: [...activeJsonThemeState.hiddenTabs],
    map: { lat: center.lat, lng: center.lng, zoom: map.getZoom() }
  };
}
function decodeJsonThemeHash() {
  if (!location.hash || location.hash.length > 10000) return null;
  try {
    const decoded = decodeURIComponent(escape(atob(location.hash.slice(1))));
    return JSON.parse(decoded);
  } catch { return null; }
}
///////////////////////////////////////////////////////////////////////////
// Restores validated JSON theme filters and map position from the URL hash.
///////////////////////////////////////////////////////////////////////////
function restoreJsonThemeState() {
  const saved = decodeJsonThemeHash();
  if (!saved || typeof saved !== 'object') return;
  const config = activeJsonThemeConfig();
  const tabKeys = new Set(config.tabs.map(tab => tab.key));
  const knownColumns = new Map(config.tabs.map(tab => [tab.key, new Set(jsonThemeColumns(tab.key))]));
  const filters = saved.filters || {};
  const serialized = {
    text: filters.text || saved.search,
    range: filters.range || saved.range,
    operators: filters.operators || saved.operator,
    dropdown: filters.dropdown || saved.dropdown
  };
  ['text', 'range', 'operators', 'dropdown'].forEach(kind => {
    Object.entries(serialized[kind] || {}).forEach(([tabKey, entries]) => {
      if (!tabKeys.has(tabKey) || !entries || typeof entries !== 'object') return;
      const target = jsonThemeFilterBucket(kind, tabKey);
      Object.entries(entries).forEach(([field, value]) => {
        if (!knownColumns.get(tabKey).has(field)) return;
        if (kind === 'text' && typeof value === 'string') target[field] = value.slice(0, 500);
        else if (kind === 'range' && value !== '' && Number.isFinite(Number(typeof value === 'object' ? value.value : value))) {
          target[field] = Number(typeof value === 'object' ? value.value : value);
          if (typeof value === 'object' && ['gte', 'lte'].includes(value.operator)) jsonThemeFilterBucket('operators', tabKey)[field] = value.operator;
        }
        else if (kind === 'operators' && ['gte', 'lte'].includes(value)) target[field] = value;
        else if (kind === 'dropdown' && Array.isArray(value)) target[field] = value.filter(item => typeof item === 'string').slice(0, 100);
      });
    });
  });
  const special = saved.specialFilter || saved.special;
  if (config.tabs.some(tab => tab.key === special && tab.specialFilter)) activeJsonThemeState.specialFilter = special;
  if (Array.isArray(saved.hiddenTabs)) {
    const hideable = new Set(config.tabs.filter(tab => tab.hideable && !tab.isPrimary).map(tab => tab.key));
    activeJsonThemeState.hiddenTabs = new Set(saved.hiddenTabs.filter(key => hideable.has(key)));
  }
  const center = saved.map?.center || (Number.isFinite(saved.map?.lng) && Number.isFinite(saved.map?.lat) ? [saved.map.lng, saved.map.lat] : null);
  const zoom = saved.map?.zoom;
  if (Array.isArray(center) && center.length === 2 && center.every(Number.isFinite) &&
      Math.abs(center[0]) <= 180 && Math.abs(center[1]) <= 85.051129 &&
      Number.isFinite(zoom) && zoom >= 0 && zoom <= 28) map.jumpTo({ center, zoom });
}
///////////////////////////////////////////////////////////////////////////
// Copies the current JSON theme filters and map view as a shareable URL.
///////////////////////////////////////////////////////////////////////////
async function copyJsonThemeLink() {
  const state = btoa(unescape(encodeURIComponent(JSON.stringify(jsonThemeShareState()))));
  const url = `${location.origin}${location.pathname}${location.search}#${state}`;
  try {
    await navigator.clipboard.writeText(url);
    toast('Filtered map link copied');
  } catch {
    window.prompt('Copy this link', url);
  }
}
///////////////////////////////////////////////////////////////////////////
// Exports the current JSON theme result sets to a multi-sheet workbook.
///////////////////////////////////////////////////////////////////////////
function exportJsonThemeExcel() {
  if (!window.XLSX) return toast('Excel export is unavailable.');
  const config = activeJsonThemeConfig();
  const workbook = XLSX.utils.book_new();
  config.tabs.forEach(tab => {
    const activeRows = jsonThemeRows(tab.key).filter(row => activeJsonThemeState.finalIds.has(row[config.linkField]));
    const rows = tab.isPrimary || tab.exportRows === 'filtered'
      ? filterJsonThemeRows(tab.key, activeRows)
      : activeRows;
    const clean = rows.map(row => Object.fromEntries(Object.entries(row).filter(([field]) => !config.hiddenColumns.includes(field))));
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(clean), tab.label.slice(0, 31));
  });
  XLSX.writeFile(workbook, `${config.title.replace(/\s+/g, '_')}_filtered.xlsx`);
  toast('Excel export prepared');
}
$('jsonClearBtn').onclick = clearJsonThemeFilters;
$('jsonCopyBtn').onclick = copyJsonThemeLink;
$('jsonExcelBtn').onclick = exportJsonThemeExcel;
const inViewGroups = [];
///////////////////////////////////////////////////////////////////////////
// Builds vector layer groups and controls from the active MapLibre style.
///////////////////////////////////////////////////////////////////////////
function buildLegend() {
  inViewGroups.length = 0;
  const st = map.getStyle();
  const sourceLayers = [...new Set(st.layers.filter(l => l['source-layer']).map(l => l['source-layer']))];
  const groups = (st.metadata && st.metadata['mapsplat:legend-groups']) || [{ name: 'Layers', layers: sourceLayers }];
  window.LEGEND_GROUP_LAYERS = {};
  groups.forEach(group => {
    window.LEGEND_GROUP_LAYERS[group.name] = [...new Set([
      ...(window.LEGEND_GROUP_LAYERS[group.name] || []), ...(group.layers || [])
    ])];
  });
  const lg = $('legend');
  lg.innerHTML = '';
  groups.forEach(g => {
    const group = addGroup(lg, g.name);
    const body = group.body;
    g.layers.forEach(sl => {
      const initialOn = (CONFIG.layerDefaults || {})[sl] === true;
      const entries = [];   // one entry per rule; small black centre-dot layers fold into the previous entry
      st.layers.filter(l => l['source-layer'] === sl).forEach(l => {
        const p = l.paint || {};
        const isDot = (l.type === 'circle' && p['circle-color'] === '#000000' && (p['circle-radius'] || 0) < 2.5)
          || (l.type === 'fill' && p['fill-opacity'] === 0);
        if (isDot && entries.length) { entries[entries.length - 1].ids.push(l.id); entries[entries.length - 1].dot = true; }
        else entries.push({ l, ids: [l.id], dot: false });
      });
      // expand data-driven colour layers into one entry per class
      const expanded = [];
      entries.forEach(en => {
        const cls = colorClasses(en.l);
        if (!cls) return expanded.push(en);
        const state = { hidden: initialOn ? new Set() : new Set(cls), total: cls.length, orig: {} };
        en.ids.forEach(id => state.orig[id] = (st.layers.find(x => x.id === id) || {}).filter);
        cls.forEach(c => expanded.push({ ...en, cls: c, state }));
      });
      const gl = document.createElement('div');
      gl.dataset.sl = sl;
      gl.dataset.orderKey = `layer:${sl}`;
      gl.draggable = true;
      gl.title = `Drag to reorder ${sl.replace(/_/g, ' ')}`;
      const gchk = document.createElement('label');
      gchk.className = 'grp lname';
      gchk.innerHTML = `<input type="checkbox"${initialOn ? ' checked' : ''}> <span>${esc(sl.replace(/_/g, ' '))}</span><svg class="eye" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12z"/><circle cx="12" cy="12" r="3"/><line x1="3" y1="21" x2="21" y2="3"/></svg>`;
      const row = document.createElement('div');
      row.className = 'grprow';
      const tools = layerTools(0, infoFor(sl, g.name), v => setTransparency(sl, v));
      row.append(collapser(gl, CONFIG.collapseLayers), gchk, ...(tools.infoBtn ? [tools.infoBtn] : []), tools.btn);
      gl.append(row, ...(tools.infoPanel ? [tools.infoPanel] : []), tools.panel);
      const boxes = [];
      const clsEntries = expanded.filter(e => e.cls);
      const classToggles = CONFIG.classToggles || {};
      const toggleClasses = classToggles[sl] ?? classToggles['*'] ?? true;
      const inView = CONFIG.legendInView && clsEntries.length > CONFIG.legendInView && clsEntries.every(e => e.cls.field);
      const tg = CONFIG.classToggles || {};
      const allowToggle = (sl in tg ? tg[sl] : tg['*']) !== false;
      const items = [];
      let note = null;
      if (inView) { note = document.createElement('div'); note.className = 'hint lnote'; gl.appendChild(note); }
      expanded.forEach(en => {
        const lab = document.createElement('label');
        const toggleEntry = !en.cls || toggleClasses;
        lab.className = 'ent' + (toggleEntry ? '' : ' static');
        const L = CONFIG.legendLabels || {};
        const text = en.cls ? (L[`${en.l.id}|${en.cls.text}`] ?? L[en.cls.text] ?? (en.cls.text === '__null__' ? '(no value)' : en.cls.text))
          : (L[en.l.id] || fmtFilter(en.l.filter) || en.l.id);
        lab.innerHTML = `${toggleEntry ? `<input type="checkbox"${initialOn ? ' checked' : ''}>` : ''}${swatch(en.l, en.dot, en.cls && en.cls.color)}<span>${esc(text)}</span>`;
        const cb = lab.querySelector('input');
        if (!allowToggle) lab.classList.add('static');   // key only: the hidden box stays ticked
        if (cb) {
          cb.onchange = () => applyEntry(en, cb.checked);
          boxes.push({ cb, en });
        }
        if (inView && en.cls) items.push({ lab, en, cb });
        gl.appendChild(lab);
      });
      const gcb = gchk.querySelector('input');
      const classIds = [...new Set(clsEntries.flatMap(en => en.ids))];
      const setAll = on => {
        gcb.checked = on;
        boxes.forEach(b => { b.cb.checked = on; applyEntry(b.en, on); });
        if (!toggleClasses) setVis(classIds, on);
      };
      gcb.onchange = () => setAll(gcb.checked);
      const ids = [...new Set(st.layers.filter(l => l['source-layer'] === sl).map(l => l.id))];
      ids.forEach(id => { registerLayerVisibility(id, initialOn); group.layerIds.add(id); });
      ctl.data[sl] = { set: setAll, theme: on => setThemeVisibility(ids, on), el: gl };
      if (initialOn) setAll(true);
      if (inView) inViewGroups.push({ sl, gcb, items, note });
      body.appendChild(gl);
    });
  });
}

// ---------- Scale visibility ----------
let scaleInfo = {}, archiveMax = null;
///////////////////////////////////////////////////////////////////////////
// Loads PMTiles and style zoom limits used to describe layer scale visibility.
///////////////////////////////////////////////////////////////////////////
async function loadScaleInfo() {
  const st = map.getStyle();
  try {
    const src = Object.values(st.sources).find(s => s.type === 'vector' && /^pmtiles:\/\//.test(s.url || ''));
    if (src) {
      const pm = new pmtiles.PMTiles(new URL(src.url.replace('pmtiles://', ''), location.href).href);
      const [h, md] = await Promise.all([pm.getHeader(), pm.getMetadata()]);
      archiveMax = h.maxZoom;
      let vl = md.vector_layers;
      if (!vl && typeof md.json === 'string') vl = JSON.parse(md.json).vector_layers;
      (vl || []).forEach(v => {
        if (typeof v.minzoom === 'number' || typeof v.maxzoom === 'number')
          scaleInfo[v.id] = { tile: true, min: v.minzoom ?? 0, max: v.maxzoom ?? Infinity };
      });
    }
  } catch (e) { console.warn('Could not read PMTiles metadata', e); }
  const bySl = {};
  st.layers.filter(l => l['source-layer']).forEach(l => (bySl[l['source-layer']] ||= []).push(l));
  Object.entries(bySl).forEach(([sl, ls]) => {
    if (ls.some(l => l.minzoom != null || l.maxzoom != null))
      scaleInfo[sl] = { tile: false, min: Math.min(...ls.map(l => l.minzoom ?? 0)), max: Math.max(...ls.map(l => l.maxzoom ?? 24)) };
  });
  Object.entries(CONFIG.layerZooms).forEach(([sl, [a, b]]) => scaleInfo[sl] = { tile: true, min: a, max: b });
}
function scaleState(sl) {
  const s = scaleInfo[sl];
  if (!s) return { hidden: false };
  const z = map.getZoom(), tz = Math.floor(z);
  if (s.tile) {
    const top = (archiveMax != null && s.max >= archiveMax) ? Infinity : s.max;
    if (tz < s.min) return { hidden: true, msg: `zoom in to level ${s.min}` };
    if (tz > top) return { hidden: true, msg: `zoom out below level ${s.max + 1}` };
  } else {
    if (z < s.min) return { hidden: true, msg: `zoom in to level ${s.min}` };
    if (z >= s.max) return { hidden: true, msg: `zoom out below level ${s.max}` };
  }
  return { hidden: false };
}
function updateScaleState() {
  if (!map.getStyle()) return;
  document.querySelectorAll('#legend [data-sl]').forEach(g => {
    const s = scaleState(g.dataset.sl);
    g.classList.toggle('offscale', s.hidden);
    g.querySelector('.grp').title = s.hidden ? `Not visible at this scale – ${s.msg}` : '';
  });
}
map.on('zoom', updateScaleState);
// Class-coloured layers with many classes: list only the classes that have features in view (unticked ones stay so they can be re-enabled)
///////////////////////////////////////////////////////////////////////////
// Updates data-driven legend classes to reflect features in the current view.
///////////////////////////////////////////////////////////////////////////
function updateInView() {
  if (!inViewGroups.length || !map.getStyle()) return;
  const cache = {};
  const valsFor = (id, field) => cache[id + '|' + field] ||= (() => {
    const vals = new Set(), nums = [];
    map.queryRenderedFeatures({ layers: [id] }).forEach(f => {
      const v = f.properties[field];
      vals.add(String(v ?? '__null__'));
      if (v != null && v !== '' && !isNaN(v)) nums.push(Number(v));
    });
    return { vals, nums };
  })();
  inViewGroups.forEach(g => {
    if (!g.gcb.checked || scaleState(g.sl).hidden) return;   // layer is off or out of scale: leave the list alone
    let any = false;
    g.items.forEach(({ lab, en, cb }) => {
      const c = en.cls, { vals, nums } = valsFor(en.ids[0], c.field);
      const here = c.labels ? c.labels.some(x => vals.has(String(x)))
        : c.other ? [...vals].some(v => !c.all.has(v)) : nums.some(n => n >= c.lo && n < c.hi);
      const show = here || !!(cb && !cb.checked);
      lab.classList.toggle('nv', !show);
      any = any || show;
    });
    g.note.textContent = any ? 'Showing classes present in the current view.' : 'No features from this layer in the current view.';
  });
}
map.on('idle', updateInView);

// ---------- Overlays (ArcGIS MapServer, WMS or XYZ) ----------
function wmsTileUrl(w) {
  const v = w.version || '1.3.0';
  return w.url + (w.url.includes('?') ? '&' : '?') +
    `service=WMS&version=${v}&request=GetMap&layers=${encodeURIComponent(w.layers)}&styles=${w.styles || ''}` +
    `&format=${w.format || 'image/png'}&transparent=true&${v === '1.3.0' ? 'crs' : 'srs'}=EPSG:3857` +
    `&width=256&height=256&bbox={bbox-epsg-3857}`;
}
function arcgisTileUrl(w) {
  const m = w.url.match(/^(.*\/MapServer)(?:\/(\d+))?\/?$/i);
  const base = m ? m[1] : w.url;
  const ids = w.layers || (m && m[2]);
  return `${base}/export?bbox={bbox-epsg-3857}&bboxSR=3857&imageSR=3857&size=256,256&dpi=96` +
    `&format=png32&transparent=true&f=image` + (ids ? `&layers=show:${ids}` : '');
}
function arcgisLegendRequest(w) {
  if (!w.url) return null;
  try {
    const url = new URL(w.url, location.href);
    const match = url.pathname.match(/^(.*\/MapServer)(?:\/(\d+))?\/?$/i);
    if (!match) return null;
    url.pathname = `${match[1]}/legend`;
    url.searchParams.set('f', 'json');
    const configured = w.layers || match[2];
    const layerIds = configured == null || configured === '' ? null
      : String(configured).replace(/^show:/i, '').split(',').map(id => id.trim()).filter(id => /^\d+$/.test(id));
    return { url: url.href, layerIds: layerIds && layerIds.length ? new Set(layerIds) : null };
  } catch { return null; }
}
const overlayTileUrl = w => w.tiles || (/\/MapServer/i.test(w.url) ? arcgisTileUrl(w) : wmsTileUrl(w));
let originalStyleIds = null;
function validRasterEntries(entries, label, reserved = []) {
  const ids = new Set(reserved);
  return entries.filter(w => {
    if (!w || !w.id || (!w.url && !w.tiles && !w.cog)) { console.warn(`${label} skipped: needs id and url, tiles, or cog`, w); return false; }
    if (ids.has(w.id)) { console.warn(`${label} skipped: duplicate id`, w.id); return false; }
    ids.add(w.id);
    return true;
  });
}
function reservedRasterIds() {
  if (originalStyleIds) return [...originalStyleIds];
  const style = map.getStyle();
  return [...Object.keys(style.sources), ...style.layers.map(l => l.id)];
}
function validOverlays() {
  return validRasterEntries(CONFIG.overlays || [], 'Overlay', reservedRasterIds());
}
function validBasemaps() {
  return validRasterEntries(CONFIG.basemaps || [], 'Basemap', [...reservedRasterIds(), ...validOverlays().map(w => w.id)]);
}
function reverseWithinGroups(entries) {
  const groups = new Map();
  entries.forEach(entry => {
    const key = entry.group || 'Overlays';
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(entry);
  });
  return [...groups.values()].flatMap(group => group.slice().reverse());
}
///////////////////////////////////////////////////////////////////////////
// Adds a configured raster overlay or basemap to the MapLibre style.
///////////////////////////////////////////////////////////////////////////
function reprojectCoords(c, from) {
  return typeof c[0] === 'number' ? proj4(from, 'EPSG:4326', c.slice(0, 2)) : c.map(x => reprojectCoords(x, from));
}
// GeoJSON overlay drawn as outline only (polygon edges and lines); `projection` is the file's CRS, e.g. 'EPSG:29902'.
function addGeojsonLayer(w, beforeId) {
  const empty = { type: 'FeatureCollection', features: [] };
  map.addSource(w.id, { type: 'geojson', data: empty, ...(w.attribution ? { attribution: w.attribution } : {}) });
  const s = w.style || {};
  map.addLayer({
    id: w.id, type: 'line', source: w.id,
    layout: { visibility: w.visible === true ? 'visible' : 'none', 'line-join': 'round' },
    paint: {
      'line-color': s.color || '#d9480f', 'line-width': s.width ?? 2, 'line-opacity': w.opacity ?? 1,
      ...(s.dasharray ? { 'line-dasharray': s.dasharray } : {})
    }
  }, beforeId);
  registerLayerVisibility(w.id, w.visible === true);
  const pointId = `${w.id}-points`;
  map.addLayer({
    id: pointId, type: 'circle', source: w.id,
    filter: ['match', ['geometry-type'], ['Point', 'MultiPoint'], true, false],
    layout: { visibility: w.visible === true ? 'visible' : 'none' },
    paint: {
      'circle-radius': s.radius ?? 5, 'circle-color': s.fill || s.color || '#d9480f',
      'circle-stroke-color': s.color || '#d9480f', 'circle-stroke-width': s.width ?? 1,
      'circle-opacity': w.opacity ?? 1, 'circle-stroke-opacity': w.opacity ?? 1
    }
  }, beforeId);
  registerLayerVisibility(pointId, w.visible === true);
  w.layerIds = [w.id, pointId];
  fetch(w.url).then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); }).then(data => {
    const from = w.projection || 'EPSG:4326';
    if (from !== 'EPSG:4326') (data.features || []).forEach(f => { if (f.geometry?.coordinates) f.geometry.coordinates = reprojectCoords(f.geometry.coordinates, from); });
    map.getSource(w.id).setData(data);
  }).catch(error => toast(`Could not load ${w.name || w.id}: ${error.message}`));
}
function addRasterLayer(w, beforeId) {
  if (w.geojson) return addGeojsonLayer(w, beforeId);
  const source = w.cog
    ? { type: 'raster', url: `cog://${new URL(w.cog, location.href).href}`, tileSize: w.tileSize || 256 }
    : { type: 'raster', tileSize: w.tileSize || 256, tiles: Array.isArray(w.tiles) ? w.tiles : [overlayTileUrl(w)] };
  if (w.attribution) source.attribution = w.attribution;
  if (Number.isFinite(w.maxzoom)) source.maxzoom = w.maxzoom;
  map.addSource(w.id, source);
  const layer = {
    id: w.id, type: 'raster', source: w.id,
    layout: { visibility: w.visible === true ? 'visible' : 'none' },
    paint: { 'raster-opacity': w.opacity ?? 1 }
  };
  if (Number.isFinite(w.minzoom)) layer.minzoom = w.minzoom;
  map.addLayer(layer, beforeId);
  registerLayerVisibility(w.id, w.visible === true);
}

function configuredTerrainModels() {
  const t = CONFIG.terrain || {};
  const configured = Array.isArray(t.models) && t.models.length ? t.models : t.cog
    ? [{ id: 'default', name: t.modelName || t.hillshadeName || 'DTM', cog: t.cog, tileSize: t.tileSize, attribution: t.attribution }]
    : [];
  const ids = new Set(), models = [];
  configured.forEach((model, index) => {
    if (!model || typeof model.cog !== 'string' || !model.cog.trim()) {
      console.warn('Terrain model skipped: needs a COG path', model);
      return;
    }
    const id = String(model.id || `model-${index + 1}`);
    if (ids.has(id)) { console.warn('Terrain model skipped: duplicate id', id); return; }
    ids.add(id);
    models.push({ ...model, id, name: model.name || id, sourceId: `dtm-${models.length}` });
  });
  return models;
}
const terrainModels = configuredTerrainModels();
let activeTerrainModel = null, terrainLayerBeforeId = null;
const CONTOUR_SOURCE_ID = 'dtm-contour-source';
const CONTOUR_LINE_ID = 'dtm-contour-lines';
const CONTOUR_LABEL_ID = 'dtm-contour-labels';
const contourSettings = (CONFIG.terrain || {}).contours;
let contoursVisible = !!contourSettings && contourSettings.visible === true;
const contourColors = { minor: '#30383b', major: '#30383b', ...(contourSettings && contourSettings.colors || {}) };
const contourLineColor = () => ['match', ['get', 'level'], 1, contourColors.major, contourColors.minor];
let contourOpacity = contourSettings && typeof contourSettings === 'object' ? contourSettings.opacity ?? 0.8 : 0.8;
const contourDemSources = new Map();
let contourDemSource = null, contourGeneration = 0;
const hillshadeMax = () => (CONFIG.terrain || {}).hillshadeStrength ?? 0.6;
let terrainShadeStrength = hillshadeMax();
const HILLSHADE_METHODS = [
  ['standard', 'Standard'], ['basic', 'Basic'], ['combined', 'Combined'],
  ['igor', 'Igor'], ['multidirectional', 'Multidirectional']
];
const HILLSHADE_STYLE_DEFAULTS = {
  method: 'standard', direction: 335, altitude: 45, anchor: 'map',
  shadowColor: '#000000', highlightColor: '#ffffff', accentColor: '#000000'
};
const hillshadeStyle = { ...HILLSHADE_STYLE_DEFAULTS, ...((CONFIG.terrain || {}).hillshadeStyle || {}) };
function hillshadePaint() {
  return {
    'hillshade-exaggeration': terrainShadeStrength,
    'hillshade-method': hillshadeStyle.method,
    'hillshade-illumination-direction': hillshadeStyle.direction,
    'hillshade-illumination-altitude': hillshadeStyle.altitude,
    'hillshade-illumination-anchor': hillshadeStyle.anchor,
    'hillshade-shadow-color': hillshadeStyle.shadowColor,
    'hillshade-highlight-color': hillshadeStyle.highlightColor,
    'hillshade-accent-color': hillshadeStyle.accentColor
  };
}
function hillshadeControlsMarkup() {
  return '<div class="hillshade-settings">' +
    '<label class="trow">Method <select class="hs-method">' + HILLSHADE_METHODS.map(([value, label]) =>
      `<option value="${value}"${hillshadeStyle.method === value ? ' selected' : ''}>${label}</option>`).join('') + '</select></label>' +
    '<label class="trow">Light direction <input class="hs-direction" type="range" min="0" max="359" step="1" value="' + hillshadeStyle.direction + '"><output class="hs-direction-value">' + hillshadeStyle.direction + '°</output></label>' +
    '<label class="trow">Light altitude <input class="hs-altitude" type="range" min="0" max="90" step="1" value="' + hillshadeStyle.altitude + '"><output class="hs-altitude-value">' + hillshadeStyle.altitude + '°</output></label>' +
    '<label class="trow">Illumination <select class="hs-anchor"><option value="map">Map north</option><option value="viewport">Viewport</option></select></label>' +
    '<div class="hillshade-colors">' +
      '<label>Shadow <input class="hs-shadow" type="color" value="' + esc(hillshadeStyle.shadowColor) + '"></label>' +
      '<label>Highlight <input class="hs-highlight" type="color" value="' + esc(hillshadeStyle.highlightColor) + '"></label>' +
      '<label>Accent <input class="hs-accent" type="color" value="' + esc(hillshadeStyle.accentColor) + '"></label>' +
    '</div></div>';
}
function bindHillshadeControls(panel) {
  const paintProps = {
    method: 'hillshade-method', direction: 'hillshade-illumination-direction',
    altitude: 'hillshade-illumination-altitude', anchor: 'hillshade-illumination-anchor',
    shadowColor: 'hillshade-shadow-color', highlightColor: 'hillshade-highlight-color', accentColor: 'hillshade-accent-color'
  };
  const setStyle = (key, value) => {
    hillshadeStyle[key] = value;
    if (map.getLayer('hillshade')) map.setPaintProperty('hillshade', paintProps[key], value);
  };
  const method = panel.querySelector('.hs-method');
  method.value = hillshadeStyle.method;
  method.onchange = () => setStyle('method', method.value);
  const anchor = panel.querySelector('.hs-anchor');
  anchor.value = hillshadeStyle.anchor;
  anchor.onchange = () => setStyle('anchor', anchor.value);
  const direction = panel.querySelector('.hs-direction'), directionValue = panel.querySelector('.hs-direction-value');
  direction.oninput = () => { directionValue.value = direction.value + '°'; setStyle('direction', Number(direction.value)); };
  const altitude = panel.querySelector('.hs-altitude'), altitudeValue = panel.querySelector('.hs-altitude-value');
  altitude.oninput = () => { altitudeValue.value = altitude.value + '°'; setStyle('altitude', Number(altitude.value)); };
  [['shadowColor', '.hs-shadow'], ['highlightColor', '.hs-highlight'], ['accentColor', '.hs-accent']].forEach(([key, selector]) => {
    const input = panel.querySelector(selector);
    input.oninput = () => setStyle(key, input.value);
  });
}
function contourControlsMarkup() {
  return '<div class="hillshade-colors">' +
    '<label>Minor <input class="ct-minor" type="color" value="' + esc(contourColors.minor) + '"></label>' +
    '<label>Major <input class="ct-major" type="color" value="' + esc(contourColors.major) + '"></label></div>';
}
function bindContourControls(panel) {
  const apply = () => {
    if (map.getLayer(CONTOUR_LINE_ID)) map.setPaintProperty(CONTOUR_LINE_ID, 'line-color', contourLineColor());
    if (map.getLayer(CONTOUR_LABEL_ID)) map.setPaintProperty(CONTOUR_LABEL_ID, 'text-color', contourColors.major);
  };
  [['minor', '.ct-minor'], ['major', '.ct-major']].forEach(([key, selector]) => {
    const input = panel.querySelector(selector);
    input.oninput = () => { contourColors[key] = input.value; apply(); };
  });
}
function allOverlays() {   // configured overlays + the built-in hillshade
  const list = validOverlays(), t = CONFIG.terrain;
  if (t && terrainModels.length && t.contours !== false && window.MaplibreCOGProtocol && window.mlcontour)
    list.push({ id: CONTOUR_LINE_ID, layerIds: [CONTOUR_LINE_ID, CONTOUR_LABEL_ID], name: contourSettings?.name || 'Contours', group: t.group || 'Terrain', contours: true, builtin: true, global: true, visible: contoursVisible, opacity: contourOpacity, info: contourSettings?.info });
  if (t && terrainModels.length && t.hillshade !== false && window.MaplibreCOGProtocol)
    list.push({ id: 'hillshade', name: t.hillshadeName || 'Hillshade (DTM)', group: t.group || 'Terrain', hillshade: true, builtin: true, global: t.allThemes !== false, visible: !!t.hillshadeVisible, opacity: 1, info: t.info });
  if (t && terrainModels.length && window.MaplibreCOGProtocol)
    list.push({ id: 'terrain3d', name: '3D terrain', group: t.group || 'Terrain', terrain: true, builtin: true, global: true });
  return list;
}
const setOverlayTransparency = (w, v) => {
  if (w.hillshade) {
    terrainShadeStrength = hillshadeMax() * (1 - v / 100);   // hillshade has no opacity: transparency scales its strength
    map.setPaintProperty(w.id, 'hillshade-exaggeration', terrainShadeStrength);
  } else if (w.contours) {
    contourOpacity = 1 - v / 100;
    if (map.getLayer(CONTOUR_LINE_ID)) map.setPaintProperty(CONTOUR_LINE_ID, 'line-opacity', contourOpacity);
    if (map.getLayer(CONTOUR_LABEL_ID)) map.setPaintProperty(CONTOUR_LABEL_ID, 'text-opacity', contourOpacity);
  } else if (w.geojson) {
    map.setPaintProperty(w.id, 'line-opacity', 1 - v / 100);
    map.setPaintProperty(`${w.id}-points`, 'circle-opacity', 1 - v / 100);
    map.setPaintProperty(`${w.id}-points`, 'circle-stroke-opacity', 1 - v / 100);
  } else map.setPaintProperty(w.id, 'raster-opacity', 1 - v / 100);
};
function removeTerrainContours() {
  [CONTOUR_LABEL_ID, CONTOUR_LINE_ID].forEach(id => { if (map.getLayer(id)) map.removeLayer(id); });
  if (map.getSource(CONTOUR_SOURCE_ID)) map.removeSource(CONTOUR_SOURCE_ID);
  contourDemSource = null;
}
///////////////////////////////////////////////////////////////////////////
// Creates contour sources and layers for the selected elevation model.
///////////////////////////////////////////////////////////////////////////
async function setupTerrainContours(model, beforeId = terrainLayerBeforeId) {
  const generation = ++contourGeneration;
  removeTerrainContours();
  if (contourSettings === false || !window.mlcontour || !window.MaplibreCOGProtocol || !map.getSource(model.sourceId)) return;
  try {
    const cogUrl = new URL(model.cog, location.href).href;
    const metadata = await window.MaplibreCOGProtocol.getCogMetadata(cogUrl);
    if (generation !== contourGeneration) return;
    const zooms = (metadata.images || []).filter(image => !image.isMask).map(image => Math.round(image.zoom)).filter(Number.isFinite);
    const maxzoom = zooms.length ? Math.max(...zooms) : (model.maxzoom || 14);
    let source = contourDemSources.get(cogUrl);
    if (!source) {
      source = new window.mlcontour.DemSource({
        url: `cog://${cogUrl}#dem/{z}/{x}/{y}`,
        encoding: 'mapbox', maxzoom, worker: false, cacheSize: 128
      });
      source.manager.getTile = async (url, abortController) => {
        if (abortController.signal.aborted) throw new DOMException('Aborted', 'AbortError');
        const { data: bitmap } = await window.MaplibreCOGProtocol.cogProtocol({ url, type: 'image' });
        if (abortController.signal.aborted) { bitmap.close(); throw new DOMException('Aborted', 'AbortError'); }
        return { data: bitmap };
      };
      // Decode the Terrain-RGB bitmap at native size (no resampling); transparent (no-data) pixels become NaN.
      source.manager.decodeImage = async (bitmap) => {
        const { width, height } = bitmap;
        const canvas = typeof OffscreenCanvas !== 'undefined'
          ? new OffscreenCanvas(width, height) : Object.assign(document.createElement('canvas'), { width, height });
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        ctx.drawImage(bitmap, 0, 0);
        const px = ctx.getImageData(0, 0, width, height).data;
        const out = new Float32Array(width * height);
        for (let i = 0; i < out.length; i++) {
          const j = i * 4;
          const raw = px[j] * 65536 + px[j + 1] * 256 + px[j + 2];
          // The COG protocol encodes no-data as an opaque 0 m; left in, it contours every level along the DEM edge.
          out[i] = px[j + 3] < 255 || raw === 100000 ? NaN : raw * 0.1 - 10000;
        }
        return { width, height, data: out };
      };
      source.setupMaplibre(maplibregl);
      contourDemSources.set(cogUrl, source);
    }
    const thresholds = contourSettings && contourSettings.thresholds || {
      8: [100, 500], 9: [100, 500], 10: [100, 500], 11: [100, 500],
      12: [50, 250], 13: [20, 100], 14: [10, 50], 15: [10, 50], 16: [5, 25]
    };
    map.addSource(CONTOUR_SOURCE_ID, {
      type: 'vector', tiles: [source.contourProtocolUrl({ thresholds })], maxzoom
    });
    const before = beforeId && map.getLayer(beforeId) ? beforeId : undefined;
    map.addLayer({
      id: CONTOUR_LINE_ID, type: 'line', source: CONTOUR_SOURCE_ID, 'source-layer': 'contours',
      layout: { visibility: contoursVisible ? 'visible' : 'none' },
      paint: { 'line-color': contourLineColor(), 'line-opacity': contourOpacity,
        'line-width': ['match', ['get', 'level'], 1, 1.2, 0.7] }
    }, before);
    map.addLayer({
      id: CONTOUR_LABEL_ID, type: 'symbol', source: CONTOUR_SOURCE_ID, 'source-layer': 'contours',
      filter: ['>', ['get', 'level'], 0],
      layout: { visibility: contoursVisible ? 'visible' : 'none', 'symbol-placement': 'line',
        'text-size': 10, 'text-font': ['Noto Sans Regular'],
        'text-field': ['concat', ['number-format', ['get', 'ele'], {}], ' m'] },
      paint: { 'text-color': contourColors.major, 'text-opacity': contourOpacity,
        'text-halo-color': '#fff', 'text-halo-width': 1.2 }
    }, before);
    contourDemSource = source;
    [CONTOUR_LINE_ID, CONTOUR_LABEL_ID].forEach(id => {
      if (layerVisibility.has(id)) {
        const state = layerVisibility.get(id);
        state.selected = contoursVisible;
        syncLayerVisibility(id);
      } else registerLayerVisibility(id, contoursVisible);
    });
  } catch (error) {
    console.error(`Could not generate contours for ${model.name}:`, error);
  }
}
const arcgisLegendCache = new Map();
const arcgisLegendViews = new Map();
const arcgisCapabilityCache = new Map();
const arcgisIdentifyDisabled = new Set();
const arcgisViewValues = new Map();
let arcgisLastViewKey = '';
function arcgisServiceUrl(request) {
  const url = new URL(request.url);
  url.pathname = url.pathname.replace(/\/legend$/i, '');
  url.searchParams.delete('f');
  return url;
}
function applyArcgisLegendView(w) {
  const view = arcgisLegendViews.get(w.id);
  if (!view) return;
  view.legend.querySelector('.arcgis-legend-empty')?.remove();
  view.legend.querySelectorAll('.arcgis-legend-note').forEach(note => note.remove());
  let filtered = 0, shown = 0;
  view.legend.querySelectorAll('.arcgis-legend-entry').forEach(row => {
    const values = row._arcgisValues;
    const inView = arcgisViewValues.get(`${view.serviceKey}|${row._arcgisLayerId}`);
    if (!Array.isArray(values) || !values.length || !inView) {
      row.classList.remove('nv');
      return;
    }
    const present = values.some(value => inView.has(String(value)));
    row.classList.toggle('nv', !present);
    filtered++;
    if (present) shown++;
  });
  if (filtered && !shown) {
    const note = document.createElement('div');
    note.className = 'arcgis-legend-empty';
    note.textContent = 'No symbols in the current view.';
    view.legend.appendChild(note);
  }
  if (view.notice) {
    const note = document.createElement('div');
    note.className = 'arcgis-legend-note';
    note.textContent = view.notice;
    view.legend.appendChild(note);
  }
}
function setArcgisServiceNotice(service, text) {
  const serviceKey = service.serviceUrl.href;
  service.layerIds.forEach(id => arcgisViewValues.delete(`${serviceKey}|${id}`));
  const targetId = service.overlays.find(w => arcgisLegendViews.has(w.id))?.id;
  arcgisLegendViews.forEach((view, id) => {
    if (view.serviceKey !== serviceKey) return;
    view.notice = id === targetId ? text : '';
    applyArcgisLegendView({ id });
  });
}
function arcgisSupportsQuery(serviceUrl) {
  const url = new URL(serviceUrl);
  url.searchParams.set('f', 'json');
  const key = url.href;
  if (!arcgisCapabilityCache.has(key)) {
    arcgisCapabilityCache.set(key, fetch(key).then(response => {
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return response.json();
    }).then(data => {
      if (data.error) throw new Error(data.error.message || 'ArcGIS service request failed');
      return String(data.capabilities || '').split(',').includes('Query');
    }));
  }
  return arcgisCapabilityCache.get(key);
}
///////////////////////////////////////////////////////////////////////////
// Fetches and applies ArcGIS identify results for overlays visible in the map.
///////////////////////////////////////////////////////////////////////////
async function updateArcgisLegendInView() {
  if (!map.getStyle()) return;
  const services = new Map();
  validOverlays().forEach(w => {
    if (!map.getLayer(w.id) || map.getLayoutProperty(w.id, 'visibility') !== 'visible') return;
    const request = arcgisLegendRequest(w);
    if (!request || !request.layerIds) return;
    const serviceUrl = arcgisServiceUrl(request);
    const serviceKey = serviceUrl.href;
    if (!services.has(serviceKey)) services.set(serviceKey, { serviceUrl, layerIds: new Set(), overlays: [] });
    const service = services.get(serviceKey);
    request.layerIds.forEach(id => service.layerIds.add(id));
    service.overlays.push(w);
  });
  if (!services.size) return;
  const bounds = map.getBounds();
  const canvas = map.getCanvas();
  const extent = [bounds.getWest(), bounds.getSouth(), bounds.getEast(), bounds.getNorth()];
  const viewKey = `${extent.map(value => value.toFixed(5)).join(',')}|${canvas.clientWidth},${canvas.clientHeight}|` +
    [...services].map(([key, service]) => `${key}:${[...service.layerIds].sort().join(',')}`).sort().join('|');
  if (viewKey === arcgisLastViewKey) return;
  arcgisLastViewKey = viewKey;
  await Promise.all([...services.entries()].map(async ([serviceKey, service]) => {
    if (arcgisIdentifyDisabled.has(serviceKey)) {
      setArcgisServiceNotice(service, 'View filtering is unavailable for this service; all symbols are shown.');
      return;
    }
    try {
      if (!await arcgisSupportsQuery(service.serviceUrl)) {
        arcgisIdentifyDisabled.add(serviceKey);
        setArcgisServiceNotice(service, 'View filtering is unavailable for this service; all symbols are shown.');
        return;
      }
      const url = new URL(service.serviceUrl);
      url.pathname += '/identify';
      const params = {
        f: 'json', geometry: JSON.stringify({ xmin: extent[0], ymin: extent[1], xmax: extent[2], ymax: extent[3], spatialReference: { wkid: 4326 } }),
        geometryType: 'esriGeometryEnvelope', sr: '4326', mapExtent: extent.join(','),
        imageDisplay: `${canvas.clientWidth},${canvas.clientHeight},96`, tolerance: '3',
        layers: `visible:${[...service.layerIds].join(',')}`, returnGeometry: 'false'
      };
      Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, value));
      const response = await fetch(url.href);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      if (data.error) throw new Error(data.error.message || 'ArcGIS identify request failed');
      const counts = new Map(), values = new Map();
      (data.results || []).forEach(result => {
        const id = String(result.layerId);
        counts.set(id, (counts.get(id) || 0) + 1);
        if (result.value !== undefined && result.value !== null && result.value !== '') {
          if (!values.has(id)) values.set(id, new Set());
          values.get(id).add(String(result.value));
        }
      });
      service.layerIds.forEach(id => {
        const count = counts.get(id) || 0, found = values.get(id);
        const key = `${serviceKey}|${id}`;
        if (count < 1000 && (!count || found?.size)) arcgisViewValues.set(key, found || new Set());
        else arcgisViewValues.delete(key);
      });
      service.overlays.forEach(applyArcgisLegendView);
    } catch (error) {
      arcgisIdentifyDisabled.add(serviceKey);
      setArcgisServiceNotice(service, 'View filtering is unavailable for this service; all symbols are shown.');
      console.warn('Could not filter ArcGIS legend to the current view:', error);
    }
  }));
}
function renderArcgisLegend(container, w) {
  const request = arcgisLegendRequest(w);
  if (!request) return;
  const legend = document.createElement('div');
  legend.className = 'arcgis-legend';
  legend.textContent = 'Loading legend…';
  container.appendChild(legend);
  const serviceKey = arcgisServiceUrl(request).href;
  arcgisLegendViews.set(w.id, { legend, serviceKey, notice: '' });
  if (!arcgisLegendCache.has(request.url)) {
    arcgisLegendCache.set(request.url, fetch(request.url).then(response => {
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return response.json();
    }).then(data => {
      if (data.error) throw new Error(data.error.message || 'ArcGIS legend request failed');
      return data;
    }));
  }
  arcgisLegendCache.get(request.url).then(data => {
    const layers = (data.layers || []).filter(layer => !request.layerIds || request.layerIds.has(String(layer.layerId)));
    const entries = layers.flatMap(layer => (layer.legend || []).map(entry => ({ layer, entry })))
      .filter(({ entry }) => entry.imageData || entry.url);
    legend.replaceChildren();
    if (!entries.length) {
      legend.textContent = 'No legend entries available.';
      return;
    }
    entries.forEach(({ layer, entry }) => {
      const row = document.createElement('div');
      row.className = 'arcgis-legend-entry';
      row._arcgisLayerId = String(layer.layerId);
      row._arcgisValues = Array.isArray(entry.values) ? entry.values : [];
      const label = entry.label || layer.layerName || '';
      const image = document.createElement('img');
      image.alt = label;
      image.src = entry.imageData
        ? `data:${entry.contentType || 'image/png'};base64,${entry.imageData}`
        : new URL(entry.url, request.url).href;
      row.appendChild(image);
      if (entry.label) {
        const text = document.createElement('span');
        text.textContent = entry.label;
        row.appendChild(text);
      }
      legend.appendChild(row);
    });
    applyArcgisLegendView(w);
  }).catch(error => {
    console.warn(`Could not load ArcGIS legend for ${w.name || w.id}:`, error);
    legend.textContent = 'Legend unavailable.';
  });
}
map.on('idle', updateArcgisLegendInView);
map.on('moveend', updateArcgisLegendInView);
///////////////////////////////////////////////////////////////////////////
// Builds grouped layer controls for configured raster and terrain overlays.
///////////////////////////////////////////////////////////////////////////
function buildOverlayLegend() {
  const lg = $('legend');
  const byGroup = {};
  allOverlays().forEach(w => (byGroup[w.group || 'Overlays'] ||= []).push(w));
  Object.entries(byGroup).forEach(([name, list]) => {
    const group = addGroup(lg, name);
    const body = group.body;
    list.forEach(w => {
      if (w.terrain) {   // 3D on/off, in sync with the menu button
        const d = document.createElement('div');
        d.dataset.nokey = '1';
        const modelSelect = terrainModels.length > 1
          ? '<label class="trow">Model <select class="terrain-model">' + terrainModels.map(m => `<option value="${esc(m.id)}">${esc(m.name)}</option>`).join('') + '</select></label>'
          : '';
        d.innerHTML = '<div class="grprow"><span class="cspace"></span><label class="lname"><input type="checkbox"> <span>' + esc(w.name) + '</span></label>' +
          '<button class="tbtn terrain-tools" type="button" title="Terrain settings" aria-label="Terrain settings" aria-expanded="false">' + ICON_SLIDERS + '</button></div>' +
          '<div class="lpanel terrain-panel" hidden>' + (modelSelect ? modelSelect : '') + '<label class="trow">Exaggeration <input class="terrain-exaggeration" type="range" min="1" max="3" step="0.1" value="' + terrainExaggeration + '"><span class="tval"></span></label></div>';
        terrainCb = d.querySelector('input');
        terrainCb.onchange = () => setTerrain3D(terrainCb.checked && !terrainGroupHidden, false);
        const modelPicker = d.querySelector('.terrain-model');
        if (modelPicker) {
          modelPicker.value = activeTerrainModel.id;
          modelPicker.onchange = () => setTerrainModel(modelPicker.value);
        }
        const terrainTools = d.querySelector('.terrain-tools');
        const terrainPanel = d.querySelector('.lpanel');
        terrainTools.onclick = () => {
          terrainPanel.hidden = !terrainPanel.hidden;
          terrainTools.setAttribute('aria-expanded', String(!terrainPanel.hidden));
        };
        const terrainSlider = d.querySelector('.terrain-exaggeration');
        const terrainValue = d.querySelector('.tval');
        terrainExaggeration = Number(terrainSlider.value);
        terrainValue.textContent = terrainExaggeration.toFixed(1) + 'x';
        terrainSlider.oninput = () => {
          terrainExaggeration = Number(terrainSlider.value);
          terrainValue.textContent = terrainExaggeration.toFixed(1) + 'x';
          if (terrainOn) map.setTerrain({ source: activeTerrainModel.sourceId, exaggeration: terrainExaggeration });
        };
        body.appendChild(d);
        return;
      }
      const transp = 100 - Math.round((w.opacity ?? 1) * 100);
      const d = document.createElement('div');
      d.dataset.orderKey = `overlay:${w.id}`;
      d.draggable = true;
      d.title = `Drag to reorder ${w.name || w.id}`;
      d.innerHTML = `<div class="grprow"><label class="lname"><input type="checkbox"${w.visible === true ? ' checked' : ''}> <span>${esc(w.name || w.id)}</span></label></div>`;
      const cb = d.querySelector('input');
      const layerIds = w.layerIds || [w.id];
      const setOverlayVisibility = on => {
        cb.checked = on;
        if (w.contours) contoursVisible = cb.checked;
        setVis(layerIds, on);
      };
      cb.onchange = () => setOverlayVisibility(cb.checked);
      if (!w.global) ctl.ov[w.id] = { theme: on => setThemeVisibility(layerIds, on), set: setOverlayVisibility, el: d };
      const t = layerTools(transp, infoFor(w.id, name, w.info), v => setOverlayTransparency(w, v),
        w.hillshade ? hillshadeControlsMarkup() : w.contours ? contourControlsMarkup() : '');
      const rowEl = d.querySelector('.grprow');
      if (w.legendUrl || arcgisLegendRequest(w)) rowEl.prepend(collapser(d, CONFIG.collapseLayers)); else rowEl.insertAdjacentHTML('afterbegin', '<span class="cspace"></span>');
      if (t.infoBtn) rowEl.appendChild(t.infoBtn);
      rowEl.appendChild(t.btn);
      if (t.infoPanel) d.appendChild(t.infoPanel);
      d.appendChild(t.panel);
      if (w.hillshade) bindHillshadeControls(t.panel);
      if (w.contours) bindContourControls(t.panel);
      if (w.legendUrl) d.insertAdjacentHTML('beforeend', `<img src="${esc(w.legendUrl)}" alt="" style="max-width:100%;margin:2px 0 4px 20px">`);
      else renderArcgisLegend(d, w);
      body.appendChild(d);
      layerIds.forEach(id => group.layerIds.add(id));
    });
    const hasTerrain = list.some(w => w.terrain);
    if (hasTerrain) group.onVisibilityChange = visible => {
      terrainGroupHidden = !visible;
      if (!visible && terrainOn) setTerrain3D(false, false);
      else if (visible && terrainCb && terrainCb.checked && !terrainOn) setTerrain3D(true, false);
    };
  });
}

///////////////////////////////////////////////////////////////////////////
// Builds the persistent basemap controls from the global configuration.
///////////////////////////////////////////////////////////////////////////
function buildBasemapLegend() {
  const entries = validBasemaps();
  if (!entries.length) return;
  const group = addGroup($('legend'), 'Basemaps');
  entries.forEach(w => {
    const d = document.createElement('div');
    d.dataset.orderKey = `basemap:${w.id}`;
    d.draggable = true;
    d.title = `Drag to reorder ${w.name || w.id}`;
    const visible = w.visible === true;
    d.innerHTML = `<div class="grprow"><label class="lname"><input type="checkbox"${visible ? ' checked' : ''}> <span>${esc(w.name || w.id)}</span></label></div>`;
    const cb = d.querySelector('input');
    cb.onchange = () => setVis([w.id], cb.checked);
    const transp = 100 - Math.round((w.opacity ?? 1) * 100);
    const tools = layerTools(transp, infoFor(w.id, 'Basemaps', w.info), v => setOverlayTransparency(w, v));
    d.querySelector('.grprow').appendChild(tools.btn);
    d.appendChild(tools.panel);
    group.body.appendChild(d);
    group.layerIds.add(w.id);
  });
}

map.on('load', () => {
  const style = map.getStyle();
  originalStyleIds = new Set([...Object.keys(style.sources), ...style.layers.map(l => l.id)]);
  const firstData = style.layers.find(l => l['source-layer']);
  const firstSymbol = style.layers.find(l => l.type === 'symbol');
  validBasemaps().slice().reverse().forEach(w => addRasterLayer(w, (firstData || firstSymbol || {}).id));
  const tc = CONFIG.terrain;
  terrainLayerBeforeId = firstData && firstData.id;
  if (tc && terrainModels.length && window.MaplibreCOGProtocol) {
    activeTerrainModel = terrainModels.find(m => m.id === tc.defaultModel) || terrainModels[0];
    terrainModels.forEach(model => {
      const source = {
        type: 'raster-dem', url: 'cog://' + new URL(model.cog, location.href).href + '#dem',
        tileSize: model.tileSize || 256, attribution: model.attribution || tc.attribution || ''
      };
      if (Number.isFinite(model.maxzoom)) source.maxzoom = model.maxzoom;
      map.addSource(model.sourceId, source);
    });
    if (tc.hillshade !== false) map.addLayer({
      id: 'hillshade', type: 'hillshade', source: activeTerrainModel.sourceId,
      layout: { visibility: tc.hillshadeVisible ? 'visible' : 'none' },
      paint: hillshadePaint()
    }, firstData && firstData.id);
    if (tc.hillshade !== false) registerLayerVisibility('hillshade', tc.hillshadeVisible === true);
    setupTerrainContours(activeTerrainModel, firstData && firstData.id);
  } else $('terrainBtn').style.display = 'none';   // no DTM configured
  reverseWithinGroups(validOverlays()).forEach(w => addRasterLayer(w, firstSymbol && firstSymbol.id));
  buildLegend();
  buildOverlayLegend();
  buildBasemapLegend();
  enableLegendReordering();
  setupThemes();
  updateArcgisLegendInView();
  loadScaleInfo().then(updateScaleState);
  populateSearchLayers();
  if (!isMobile()) openTool('legend');   // start with the legend open on desktop only
});

// ---------- Box selection (mouse and touch) ----------
let start = null, selected = [];
const boxBtn = $('boxBtn');
const boxEl = document.createElement('div');
boxEl.id = 'selbox';
map.getCanvasContainer().appendChild(boxEl);
const mapBox = map.getCanvasContainer();

function setBox(on) {
  boxMode = on;
  boxBtn.classList.toggle('active', on);
  document.body.classList.toggle('box-on', on);
  map.getCanvas().style.cursor = on ? 'crosshair' : '';
  mapBox.style.touchAction = on ? 'none' : '';
  on ? (map.dragPan.disable(), map.touchZoomRotate.disable()) : (map.dragPan.enable(), map.touchZoomRotate.enable());
}
boxBtn.onclick = () => {
  if (!boxMode && tool && isMobile()) openTool(tool);   // get the menu out of the way on phones
  setBox(!boxMode);
};
$('globeBtn').onclick = () => {
  const globe = $('globeBtn');
  const enabled = globe.getAttribute('aria-pressed') !== 'true';
  map.setProjection({ type: enabled ? 'globe' : 'mercator' });
  globe.classList.toggle('active', enabled);
  globe.setAttribute('aria-pressed', String(enabled));
  const label = enabled ? 'Switch to Mercator view' : 'Switch to globe view';
  globe.title = label;
  globe.setAttribute('aria-label', label);
};
document.addEventListener('keydown', e => { if (e.key === 'Escape' && boxMode) setBox(false); });

const pos = e => { const r = mapBox.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
const drawBox = cur => Object.assign(boxEl.style, {
  display: 'block', left: Math.min(start.x, cur.x) + 'px', top: Math.min(start.y, cur.y) + 'px',
  width: Math.abs(cur.x - start.x) + 'px', height: Math.abs(cur.y - start.y) + 'px'
});
mapBox.addEventListener('pointerdown', e => {
  if (!boxMode || (e.pointerType === 'mouse' && e.button !== 0)) return;
  start = pos(e);
  const s = start;
  const move = ev => drawBox(pos(ev));
  const up = ev => {
    document.removeEventListener('pointermove', move);
    document.removeEventListener('pointerup', up);
    boxEl.style.display = 'none';
    runSelection(s, pos(ev));
    start = null;
  };
  document.addEventListener('pointermove', move);
  document.addEventListener('pointerup', up);
});

///////////////////////////////////////////////////////////////////////////
// Runs a vector feature query for a dragged map rectangle and opens results.
///////////////////////////////////////////////////////////////////////////
function runSelection(a, b) {
  setBox(false);
  justBoxed = true; setTimeout(() => justBoxed = false, 50);   // stops the drag from also opening a popup
  if (Math.abs(a.x - b.x) < 3 && Math.abs(a.y - b.y) < 3) return;
  selected = queryData([[a.x, a.y], [b.x, b.y]]);
  showTable(selected, `${selected.length} record(s) selected`);
}

// ---------- Results panel ----------
let activeTab = null, ring = null, shown = [], tabRows = [], tabCols = [], tableFilters = {};
function centreOf(g) {
  const pts = [];
  (function walk(c) { typeof c[0] === 'number' ? pts.push(c) : c.forEach(walk); })(g.coordinates);
  const xs = pts.map(p => p[0]), ys = pts.map(p => p[1]);
  return [(Math.min(...xs) + Math.max(...xs)) / 2, (Math.min(...ys) + Math.max(...ys)) / 2];
}
///////////////////////////////////////////////////////////////////////////
// Renders vector query results as grouped, selectable feature tables.
///////////////////////////////////////////////////////////////////////////
let tableSeq = 0;
async function showTable(feats, label) {
  const seq = ++tableSeq;
  tableFilters = {};
  const all = await withLinked(feats);
  if (seq === tableSeq) renderTable(all, label);
}
function renderTable(feats, label) {
  shown = feats;
  const groups = {};
  feats.forEach(f => (groups[f.sourceLayer || f.layer.id] ||= []).push(f));
  const names = Object.keys(groups);
  if (!names.includes(activeTab)) activeTab = names[0];
  $('count').textContent = label || `${feats.length} record(s)`;
  const wrap = $('tablewrap');
  if (!feats.length) {
    $('tabs').innerHTML = '';
    wrap.innerHTML = '<p style="padding:10px">No features found. Try a bigger box or zoom in on the area first.</p>';
    $('xlsxBtn').hidden = true;
    tabRows = []; tabCols = [];
  } else {
    $('tabs').innerHTML = names.map(n =>
      `<button class="tab${n === activeTab ? ' on' : ''}" data-tab="${esc(n)}">${esc(n.replace(/_/g, ' '))} (${groups[n].length})</button>`).join('');
    document.querySelectorAll('#tabs .tab').forEach(b => b.onclick = () => { activeTab = b.dataset.tab; renderTable(feats, label); });
    const sourceRows = groups[activeTab];
    tabCols = [...new Set(sourceRows.flatMap(f => Object.keys(f.properties)))];
    const searchable = activeThemeName === 'Boreholes' && activeTab === 'Boreholes';
    $('xlsxBtn').hidden = !searchable;
    const filterRow = searchable
      ? `<tr class="vector-filter-row">${tabCols.map(field => `<th><input class="vector-filter-input" type="search" data-field="${esc(field)}" aria-label="Search ${esc(field)}" placeholder="Search" value="${esc(tableFilters[field] || '')}"></th>`).join('')}</tr>`
      : '';
    wrap.innerHTML = `<table><thead><tr>${tabCols.map(c => `<th>${esc(c)}</th>`).join('')}</tr>${filterRow}</thead><tbody></tbody></table>`;
    const renderRows = () => {
      const filters = searchable ? Object.entries(tableFilters).filter(([, value]) => value) : [];
      tabRows = sourceRows.filter(feature => filters.every(([field, value]) =>
        String(feature.properties[field] ?? '').toLocaleLowerCase().includes(value.toLocaleLowerCase())
      ));
      const body = wrap.querySelector('tbody');
      body.innerHTML = tabRows.map((feature, index) =>
        `<tr data-i="${index}" title="Click to zoom to this record">${tabCols.map(field => `<td>${cell(feature.properties[field])}</td>`).join('')}</tr>`
      ).join('');
      body.querySelectorAll('tr').forEach(tr => tr.onclick = event => {
        if (event.target.closest('a')) return;
        const feature = tabRows[tr.dataset.i];
        if (!feature.geometry) return;
        const center = centreOf(feature.geometry);
        if (ring) ring.remove();
        const element = document.createElement('div'); element.className = 'ring';
        ring = new maplibregl.Marker({ element }).setLngLat(center).addTo(map);
        map.flyTo({ center, zoom: Math.max(map.getZoom(), 14) });
      });
    };
    wrap.querySelectorAll('.vector-filter-input').forEach(input => input.oninput = () => {
      tableFilters[input.dataset.field] = input.value;
      renderRows();
    });
    renderRows();
  }
  setResults(true);
}
// Global results panel switch (rail button); JSON themes keep their legend eye in step.
let resultsOn = false;
function setResults(on) {
  resultsOn = on;
  document.body.classList.toggle('has-table', on);
  $('tableBtn').classList.toggle('active', on);
  $('tableBtn').setAttribute('aria-pressed', String(on));
  const group = activeJsonThemeState.active && activeJsonThemeState.linkedGroup;
  if (group && activeJsonThemeState.linkedVisible !== on) group.setVisibility(on);
  if (on && !activeJsonThemeState.active && !shown.length) {
    $('count').textContent = '';
    $('tabs').innerHTML = '';
    $('tablewrap').innerHTML = '<p style="padding:10px">Click the map, draw a box or search to list features here.</p>';
  }
  map.resize();
}
function closeResults() {
  setResults(false);
  if (ring) { ring.remove(); ring = null; }
}
function clearResults() {
  selected = []; shown = []; tabRows = []; tabCols = [];
  $('xlsxBtn').hidden = true;
  closeResults();
}
$('closeBtn').onclick = closeResults;
$('tableBtn').onclick = () => setResults(!resultsOn);
$('xlsxBtn').onclick = () => {
  if (!window.XLSX) return toast('Excel export is unavailable.');
  if (!tabRows.length) return;
  const rows = tabRows.map(feature => Object.fromEntries(tabCols.map(field => [field, feature.properties[field] ?? ''])));
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(rows), (activeTab || 'Boreholes').slice(0, 31));
  XLSX.writeFile(workbook, 'Boreholes_filtered.xlsx');
  toast('Excel export prepared');
};
$('csvBtn').onclick = () => {
  if (!tabRows.length) return;
  const q = v => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const csv = [tabCols.map(q).join(','), ...tabRows.map(f => tabCols.map(c => q(f.properties[c])).join(','))].join('\r\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
  a.download = (activeTab || 'results') + '.csv';
  a.click();
  URL.revokeObjectURL(a.href);
};

// ---------- Search ----------
function populateSearchLayers() {
  const layers = [...new Set(map.getStyle().layers.filter(l => l['source-layer']).map(l => l['source-layer']))]
    .filter(l => !themeLayers || themeLayers.includes(l));
  $('searchLayer').innerHTML = layers.map(l => `<option value="${esc(l)}">${esc(l.replace(/_/g, ' '))}</option>`).join('');
  updateSearchFields();
}
function updateSearchFields() {
  const layer = $('searchLayer').value;
  const sample = queryData(wholeMap()).find(f => f.sourceLayer === layer);
  $('searchFields').innerHTML = sample
    ? Object.keys(sample.properties).map(f => `<label><input type="checkbox" value="${esc(f)}" checked>${esc(f)}</label>`).join('')
    : '<em class="hint">' + (layer ? 'No fields yet – make sure this layer is visible in the current view.' : 'This theme has no searchable layers.') + '</em>';
}
///////////////////////////////////////////////////////////////////////////
// Searches selected feature properties in the current map view.
///////////////////////////////////////////////////////////////////////////
function runSearch() {
  const text = $('searchText').value.trim().toLowerCase();
  if (!text) { $('searchText').focus(); return; }
  const layer = $('searchLayer').value;
  const fields = [...document.querySelectorAll('#searchFields input:checked')].map(cb => cb.value);
  const matches = queryData(wholeMap()).filter(f => f.sourceLayer === layer &&
    fields.some(k => f.properties[k] != null && String(f.properties[k]).toLowerCase().includes(text)));
  activeTab = null;
  showTable(matches, `${matches.length} search result(s)`);
  if (isMobile()) openTool(tool);   // reveal the results
}
$('searchLayer').addEventListener('change', updateSearchFields);
$('runSearch').addEventListener('click', runSearch);
$('searchText').addEventListener('keydown', e => { if (e.key === 'Enter') runSearch(); });

// ---------- Location search (place name, Irish grid reference, or lat/lon) ----------
const IG_LETTERS = 'ABCDEFGHJKLMNOPQRSTUVWXYZ';   // Irish Grid 100 km squares (no I), 5 x 5 from the south-west
function parseGrid(q) {
  q = q.trim().toUpperCase();
  let m = q.match(/^([A-HJ-Z])\s*(\d[\d\s]*)$/);   // e.g. J 3374 7396, J33747396, J 337 739
  if (m) {
    const parts = m[2].trim().split(/\s+/);
    let e, n;
    if (parts.length === 2 && parts[0].length === parts[1].length) [e, n] = parts;
    else if (parts.length === 1 && parts[0].length % 2 === 0) [e, n] = [parts[0].slice(0, parts[0].length / 2), parts[0].slice(parts[0].length / 2)];
    if (e && e.length <= 5) {
      const i = IG_LETTERS.indexOf(m[1]);
      return { E: (i % 5) * 100000 + Number(e.padEnd(5, '0')), N: (4 - Math.floor(i / 5)) * 100000 + Number(n.padEnd(5, '0')) };
    }
  }
  m = q.match(/^(?:E\s*)?(\d{5,6})\s*(?:,|N|\s)\s*(?:N\s*)?(\d{5,6})$/);   // 333740 373960, E 333740 N 373960
  return m ? { E: Number(m[1]), N: Number(m[2]) } : null;
}
let geoMarker = null;
const geoList = $('geoList');
const geoMsg = t => { geoList.innerHTML = `<li class="msg">${esc(t)}</li>`; geoList.hidden = false; };
function goTo(lngLat, label, bbox) {
  geoList.hidden = true;
  if (geoMarker) geoMarker.remove();
  geoMarker = new maplibregl.Marker({ color: '#e8590c' }).setLngLat(lngLat)
    .setPopup(new maplibregl.Popup({ offset: 24 }).setText(label)).addTo(map);
  geoMarker.togglePopup();
  if (bbox) map.fitBounds(bbox, { padding: 40, maxZoom: 17 }); else map.flyTo({ center: lngLat, zoom: 16 });
  if (isMobile() && tool) openTool(tool);
}
///////////////////////////////////////////////////////////////////////////
// Resolves a place name, coordinate, or Irish Grid reference and navigates there.
///////////////////////////////////////////////////////////////////////////
async function geoSearch() {
  const q = $('geoIn').value.trim();
  if (!q) { geoList.hidden = true; return; }
  const g = parseGrid(q);
  if (g) {
    const ll = proj4('EPSG:29902', 'EPSG:4326', [g.E, g.N]);
    if (ll[0] < -11 || ll[0] > -5 || ll[1] < 51 || ll[1] > 56) return geoMsg('That grid reference is outside Ireland.');
    return goTo(ll, `Irish Grid E ${g.E} N ${g.N}`);
  }
  const ll = q.includes('.') && q.match(/^(-?\d{1,2}(?:\.\d+)?)\s*[, ]\s*(-?\d{1,3}(?:\.\d+)?)$/);
  if (ll && Math.abs(ll[1]) <= 90 && Math.abs(ll[2]) <= 180) return goTo([Number(ll[2]), Number(ll[1])], `${ll[1]}, ${ll[2]}`);
  geoMsg('Searching…');
  try {
    const sc = CONFIG.search || {};
    const r = await fetch('https://nominatim.openstreetmap.org/search?format=jsonv2&limit=' + (sc.limit || 5) +
      (sc.countrycodes ? '&countrycodes=' + sc.countrycodes : '') + '&q=' + encodeURIComponent(q));
    const res = await r.json();
    if (!res.length) return geoMsg('No places found. Try a town name, a postcode or a grid reference such as J 3374 7396.');
    const pick = x => goTo([Number(x.lon), Number(x.lat)], x.display_name,
      x.boundingbox && [[Number(x.boundingbox[2]), Number(x.boundingbox[0])], [Number(x.boundingbox[3]), Number(x.boundingbox[1])]]);
    if (res.length === 1) return pick(res[0]);
    geoList.innerHTML = res.map((x, i) => `<li tabindex="0" data-i="${i}">${esc(x.display_name)}</li>`).join('');
    geoList.querySelectorAll('li').forEach(li => {
      li.onclick = () => pick(res[li.dataset.i]);
      li.onkeydown = e => { if (e.key === 'Enter') pick(res[li.dataset.i]); };
    });
  } catch (e) { geoMsg('Search failed. Check your connection and try again.'); }
}
$('geoGo').onclick = geoSearch;
$('geoIn').addEventListener('keydown', e => { if (e.key === 'Enter') geoSearch(); if (e.key === 'Escape') geoList.hidden = true; });
$('geoIn').addEventListener('search', () => { if (!$('geoIn').value) { geoList.hidden = true; if (geoMarker) { geoMarker.remove(); geoMarker = null; } } });
map.on('click', () => { geoList.hidden = true; });


// ---------- 3D terrain ----------
let toastTimer;
function toast(msg) {
  const t = $('toast');
  t.textContent = msg; t.style.display = 'block';
  clearTimeout(toastTimer); toastTimer = setTimeout(() => t.style.display = 'none', 14000);
}
// Works out why the DTM would not load and says so on the map (details are also in the browser console)
async function diagnoseDtm(model) {
  const url = new URL(model.cog, location.href).href;
  try {
    const r = await fetch(url, { headers: { Range: 'bytes=0-1023' } });
    if (r.status === 404) return `The file was not found (404): ${url}. Check the selected terrain model in CONFIG.terrain.models.`;
    if (r.status === 200) return 'The server sent the whole file instead of a byte range. COGs need a server that supports HTTP range requests (python -m http.server does not; try "npx http-server", "npx serve", nginx, Apache or IIS).';
    if (r.status !== 206) return `The server answered ${r.status} for ${url}.`;
    const b = new Uint8Array(await r.arrayBuffer());
    if (!((b[0] === 0x49 && b[1] === 0x49) || (b[0] === 0x4d && b[1] === 0x4d))) return 'That file is not a GeoTIFF (no TIFF header).';
    return null;   // file is reachable and is a TIFF: the problem is inside it
  } catch (err) { return 'The file could not be fetched (network or cross-origin problem).'; }
}
let dtmChecking = false;
map.on('error', async e => {
  const msg = (e.error && e.error.message) || '';
  const model = terrainModels.find(m => m.sourceId === e.sourceId) || activeTerrainModel;
  if (!model || (!terrainModels.some(m => m.sourceId === e.sourceId) && !(e.sourceId === undefined && /cog|tiff|geotiff/i.test(msg)))) {
    const overlay = (CONFIG.overlays || []).find(w => w.id === e.sourceId);
    if (overlay) console.error(`Overlay "${overlay.name || overlay.id}" error:`, e.error);
    return;
  }
  console.error('DTM error:', e.error);
  if (dtmChecking) return;
  dtmChecking = true;
  const why = await diagnoseDtm(model);
  toast('3D / hillshade: ' + (why || `the file is reachable but could not be read${msg ? ' (' + msg + ')' : ''}. It must be a single-band elevation COG in EPSG:3857, tiled, with overviews.`));
  setTimeout(() => dtmChecking = false, 15000);
});
let terrainOn = false, terrainCb = null, terrainGroupHidden = false;   // checkbox selection is preserved when its group is hidden
let terrainExaggeration = Math.min(10, Math.max(1, Number((CONFIG.terrain || {}).exaggeration) || 1));
///////////////////////////////////////////////////////////////////////////
// Switches the active elevation model and rebuilds dependent terrain layers.
///////////////////////////////////////////////////////////////////////////
function setTerrainModel(id) {
  const model = terrainModels.find(m => m.id === id);
  if (!model || model === activeTerrainModel) return;
  const tc = CONFIG.terrain;
  if (map.getLayer(CONTOUR_LINE_ID)) contoursVisible = map.getLayoutProperty(CONTOUR_LINE_ID, 'visibility') !== 'none';
  removeTerrainContours();
  const hillshadeVisible = map.getLayer('hillshade')
    ? map.getLayoutProperty('hillshade', 'visibility') !== 'none'
    : !!tc.hillshadeVisible;
  if (map.getLayer('hillshade')) map.removeLayer('hillshade');
  activeTerrainModel = model;
  if (terrainOn) map.setTerrain({ source: model.sourceId, exaggeration: terrainExaggeration });
  if (tc.hillshade !== false && map.getSource(model.sourceId)) {
    const layer = {
      id: 'hillshade', type: 'hillshade', source: model.sourceId,
      layout: { visibility: hillshadeVisible ? 'visible' : 'none' },
      paint: hillshadePaint()
    };
    if (terrainLayerBeforeId && map.getLayer(terrainLayerBeforeId)) map.addLayer(layer, terrainLayerBeforeId);
    else map.addLayer(layer);
  }
  setupTerrainContours(model, terrainLayerBeforeId);
}
///////////////////////////////////////////////////////////////////////////
// Enables or disables 3D terrain and synchronizes map pitch and controls.
///////////////////////////////////////////////////////////////////////////
function setTerrain3D(on, syncCheckbox = true, tilt = true) {
  const tc = CONFIG.terrain;
  if (!tc || !activeTerrainModel || !map.getSource(activeTerrainModel.sourceId)) { if (terrainCb) terrainCb.checked = false; return toast('3D view needs a DTM configured in CONFIG.terrain.models.'); }
  terrainOn = on;
  if (terrainCb && syncCheckbox) terrainCb.checked = on;
  $('terrainBtn').classList.toggle('active', on);
  if (on) { map.setTerrain({ source: activeTerrainModel.sourceId, exaggeration: terrainExaggeration }); if (tilt) map.easeTo({ pitch: tc.pitch ?? 60, duration: 900 }); }
  else { map.setTerrain(null); map.easeTo({ pitch: 0, bearing: 0, duration: 600 }); }   // everything is draped on the surface automatically
}
map.on('pitchstart', e => {   // user tilting (right-drag / two-finger swipe) switches 3D on
  if (e.originalEvent && !terrainOn && !terrainGroupHidden && activeTerrainModel && map.getSource(activeTerrainModel.sourceId)) setTerrain3D(true, true, false);
});
map.on('moveend', () => {
  if (terrainOn && map.getPitch() < 1) setTerrain3D(false);
});
$('terrainBtn').onclick = () => { if (!terrainGroupHidden) setTerrain3D(!terrainOn); };

// ---------- Print (map image + key of the layers currently switched on) ----------
function mapImage() {
  return new Promise((resolve, reject) => {
    map.once('render', () => {
      try {
        const src = map.getCanvas(), dpr = src.width / src.clientWidth;
        const c = document.createElement('canvas');
        c.width = src.width; c.height = src.height;
        const g = c.getContext('2d');
        g.drawImage(src, 0, 0);
        // scale bar drawn into the image so it stays correct whatever size the page is printed at
        const mpp = 40075016.686 * Math.cos(map.getCenter().lat * Math.PI / 180) / (512 * Math.pow(2, map.getZoom()));   // metres per CSS px
        if (map.getPitch() < 5) {   // a scale bar is only valid looking straight down
        const m = 100 * mpp, base = Math.pow(10, Math.floor(Math.log10(m)));
        const dist = [5, 2, 1].map(f => f * base).find(v => v <= m);
        const len = dist / mpp * dpr, x = 12 * dpr, y = src.height - 16 * dpr;
        g.fillStyle = 'rgba(255,255,255,.85)';
        g.fillRect(x - 6 * dpr, y - 22 * dpr, len + 12 * dpr, 34 * dpr);
        g.strokeStyle = '#000'; g.lineWidth = 2 * dpr; g.beginPath();
        g.moveTo(x, y - 6 * dpr); g.lineTo(x, y); g.lineTo(x + len, y); g.lineTo(x + len, y - 6 * dpr); g.stroke();
        g.fillStyle = '#000'; g.font = `${12 * dpr}px sans-serif`;
        g.fillText(dist >= 1000 ? dist / 1000 + ' km' : dist + ' m', x, y - 10 * dpr);
        }
        resolve(c.toDataURL('image/png'));
      } catch (e) { reject(e); }
    });
    map.triggerRepaint();
  });
}
function buildKey() {
  let html = '';
  document.querySelectorAll('#legend .lgroup').forEach(sec => {
    if (sec.hidden) return;
    let items = '';
    sec.querySelectorAll('.lgbody > div').forEach(el => {
      if (el.hidden || el.dataset.nokey || el.classList.contains('offscale')) return;
      if (el.hidden || el.classList.contains('offscale')) return;
      const name = esc(el.querySelector('.lname span').textContent);
      if (el.dataset.sl) {
        const ents = [...el.querySelectorAll('.ent')].filter(e => e.querySelector('input').checked && !e.classList.contains('nv'));
        if (ents.length) items += `<b>${name}</b>` + ents.map(e => `<div class="pv-ent">${e.querySelector('.sw').outerHTML}<span>${esc(e.lastElementChild.textContent)}</span></div>`).join('');
      } else if (el.querySelector('input').checked) {
        items += `<b>${name}</b>` + (el.querySelector('img') ? el.querySelector('img').outerHTML : '');
      }
    });
    if (items) html += `<h4>${esc(sec.querySelector('.lghead span').textContent)}</h4>${items}`;
  });
  return html;
}
///////////////////////////////////////////////////////////////////////////
// Captures the current map and layer key, then opens the print layout.
///////////////////////////////////////////////////////////////////////////
async function printMap() {
  let url;
  try { url = await mapImage(); } catch (e) { alert('The map could not be captured for printing (a layer may not allow image export).'); return; }
  const cv = map.getCanvas(), portrait = cv.clientHeight > cv.clientWidth;
  const c = map.getCenter(), [x, y] = proj4('EPSG:4326', 'EPSG:29902', [c.lng, c.lat]);
  const attr = (document.querySelector('.maplibregl-ctrl-attrib-inner') || {}).textContent || '';
  $('pageStyle').textContent = `@page { size: A4 ${portrait ? 'portrait' : 'landscape'}; margin: 10mm; }`;
  const pv = $('printView');
  pv.className = portrait ? 'portrait' : '';
  pv.innerHTML = `<div class="pv-head"><h1>${esc(CONFIG.title || document.title)}</h1><span>${new Date().toLocaleDateString()}</span></div>` +
    `<div class="pv-body"><img alt="Map" src="${url}"><div class="pv-key">${buildKey() || '<i>No layers switched on</i>'}</div></div>` +
    `<div class="pv-foot">Map centre: Irish Grid E ${x.toFixed(0)} N ${y.toFixed(0)}. ${esc(attr.trim())}${map.getPitch() >= 5 ? ' Oblique view: scale varies across the image.' : ''}</div>`;    
  const img = pv.querySelector('img');
  img.complete ? window.print() : (img.onload = () => window.print());
}
$('printBtn').onclick = printMap;
