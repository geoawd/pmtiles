const CONFIG = window.CONFIG;
proj4.defs('EPSG:29902',
  '+proj=tmerc +lat_0=53.5 +lon_0=-8 +k=1.000035 +x_0=200000 +y_0=250000 ' +
  '+ellps=mod_airy +towgs84=482.5,-130.6,564.6,-1.042,-0.214,-0.631,8.15 +units=m +no_defs');
maplibregl.addProtocol('pmtiles', new pmtiles.Protocol().tile);
if (window.MaplibreCOGProtocol) maplibregl.addProtocol('cog', MaplibreCOGProtocol.cogProtocol);
const $ = id => document.getElementById(id);
const map = new maplibregl.Map({ container: 'map', style: CONFIG.styleUrl, center: CONFIG.center, zoom: CONFIG.zoom, maxPitch: 80 });
$('aboutContent').textContent = typeof CONFIG.about === 'string' ? CONFIG.about : '';
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

const isLink = v => typeof v === 'string' && /^https:/i.test(v.trim());
const esc = s => String(s).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const cell = v => v === null || v === undefined ? '' :
  isLink(v) ? `<a href="${esc(v.trim())}" target="_blank" rel="noopener">${esc(v)}</a>` : esc(v);

map.on('mousemove', e => {
  const [x, y] = proj4('EPSG:4326', 'EPSG:29902', [e.lngLat.lng, e.lngLat.lat]);
  $('coords').textContent = `Irish Grid  E ${x.toFixed(0)}  N ${y.toFixed(0)}`;
});

// ---------- Menu ----------
let tool = null;
const isMobile = () => matchMedia('(max-width: 700px)').matches;
function openTool(name) {
  tool = name === tool ? null : name;
  document.body.classList.toggle('drawer-open', !!tool);
  document.querySelectorAll('#rail [data-tool]').forEach(b => b.classList.toggle('active', b.dataset.tool === tool));
  $('legendPage').classList.toggle('active', tool === 'legend');
  $('searchPage').classList.toggle('active', tool === 'search');
  $('aboutPage').classList.toggle('active', tool === 'about');
  if (tool === 'search') { updateSearchFields(); if (!isMobile()) $('searchText').focus(); }
  if (tool && boxMode) setBox(false);
}
document.querySelectorAll('#rail [data-tool]').forEach(b => b.onclick = () => openTool(b.dataset.tool));
document.querySelectorAll('.dclose').forEach(b => b.onclick = () => openTool(tool));

// ---------- Query helpers ----------
function dataLayers() {
  if (CONFIG.queryLayers) return CONFIG.queryLayers;
  const st = map.getStyle();
  return st.layers.filter(l => l.source && st.sources[l.source] && st.sources[l.source].type === 'vector').map(l => l.id);
}
function queryData(geom) {
  const layers = dataLayers();
  if (!layers.length) return [];
  const seen = new Set();
  return map.queryRenderedFeatures(geom, { layers }).filter(f => {
    const key = f.source + '|' + (f.sourceLayer || '') + '|' + (f.id ?? '') + '|' + JSON.stringify(f.properties);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
const around = (p, r = 5) => [[p.x - r, p.y - r], [p.x + r, p.y + r]];
const wholeMap = () => { const c = map.getCanvas(); return [[0, 0], [c.clientWidth, c.clientHeight]]; };

// ---------- Click popup ----------
let boxMode = false, justBoxed = false;
map.on('click', e => {
  if (boxMode || justBoxed) return;
  const feats = queryData(around(e.point));
  if (!feats.length) return;
  const groups = {};   // one collapsible section per layer, each with its own pager
  feats.forEach(f => (groups[f.sourceLayer || f.layer.id] ||= []).push(f));
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
  Object.entries(groups).forEach(([name, list], gi) => {
    const n = list.length;
    let i = 0;
    const sec = document.createElement('section');
    sec.className = 'idsec' + (gi ? ' collapsed' : '');
    sec.innerHTML =
      `<div class="idhead" tabindex="0" role="button" aria-expanded="${!gi}"><svg viewBox="0 0 24 24"><path d="m6 9 6 6 6-6"/></svg>` +
      `<span class="idname">${esc(name.replace(/_/g, ' '))}</span><span class="idcount">(${n})</span></div>` +
      `<div class="idbody"><div class="idtab"></div><div class="pophead"${n < 2 ? ' hidden' : ''}><button class="nav" data-d="-1" aria-label="Previous record">&#9664;</button>` +
      `<span class="pg"></span><button class="nav" data-d="1" aria-label="Next record">&#9654;</button></div></div>`;
    const head = sec.querySelector('.idhead');
    const toggle = () => toggleSection(sec);
    head.onclick = toggle;
    head.onkeydown = ev => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); toggle(); } };
    const render = () => {
      sec.querySelector('.pg').textContent = `${i + 1} of ${n}`;
      const entries = Object.entries(list[i].properties || {}).filter(([, v]) =>
        v !== null && v !== undefined && (typeof v !== 'string' || v.trim() !== ''));
      sec.querySelector('.idtab').innerHTML = entries.length
        ? entries.map(([k, v]) => `<div class="arow"><div class="akey">${esc(k)}</div><div class="aval">${cell(v)}</div></div>`).join('')
        : '<div class="idempty">No attributes with values.</div>';
    };
    sec.querySelectorAll('.nav').forEach(b => b.onclick = () => { i = (i + Number(b.dataset.d) + n) % n; render(); });
    render();
    layers.appendChild(sec);
  });
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
}
function setThemeVisibility(ids, on) {
  ids.forEach(id => {
    const state = layerVisibility.get(id);
    if (!state) return;
    state.inTheme = on;
    syncLayerVisibility(id);
  });
}
function setGroupVisibility(ids, key, on) {
  ids.forEach(id => {
    const state = layerVisibility.get(id);
    if (!state) return;
    on ? state.groups.delete(key) : state.groups.add(key);
    syncLayerVisibility(id);
  });
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

// Small per-layer panel: transparency slider (+ optional plain info link). Returns { btn, panel, infoBtn, infoPanel }.
function layerTools(transp, info, onChange) {
  const meta = info && typeof info === 'object' && info.metadata ? info : null;
  const link = typeof info === 'string' ? info : meta && meta.link;
  const btn = document.createElement('button');
  btn.className = 'tbtn'; btn.innerHTML = ICON_SLIDERS;
  btn.title = 'Transparency' + (isUrl(link) ? ' and information' : '');
  btn.setAttribute('aria-label', btn.title); btn.setAttribute('aria-expanded', 'false');
  const panel = document.createElement('div');
  panel.className = 'lpanel'; panel.hidden = true;
  panel.innerHTML = `<label class="trow">Transparency <input type="range" min="0" max="100" value="${transp}"><span class="tval">${transp}%</span></label>` +
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
  sec.innerHTML = `<h4 class="lghead"><button class="lgcollapse" type="button" aria-expanded="true"><span>${esc(name)}</span>` +
    `<svg viewBox="0 0 24 24"><path d="m6 9 6 6 6-6"/></svg></button>` +
    `<button class="lgeye" type="button" aria-pressed="false" title="Hide ${esc(name)}" aria-label="Hide ${esc(name)}">${ICON_EYE}</button></h4>` +
    '<div class="lgbody"></div>';
  const group = { key: `legend-group-${++groupSequence}`, body: sec.querySelector('.lgbody'), layerIds: new Set(), onVisibilityChange: null };
  const collapse = sec.querySelector('.lgcollapse');
  const eye = sec.querySelector('.lgeye');
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
  eye.onclick = () => group.setVisibility(!visible);
  parent.appendChild(sec);
  return group;
}
let themeLayers = null;   // null = every layer; otherwise the layer names allowed by the active theme
function setupThemes() {
  const list = CONFIG.themes || [];
  $('themeBar').hidden = !list.length;
  if (!list.length) return;
  const sel = $('themeSel');
  sel.innerHTML = list.map((t, i) => `<option value="${i}">${esc(t.name)}</option>`).join('');
  const apply = i => {
    const t = list[i];
    const all = !t.layers && !t.overlays;
    themeLayers = all ? null : (t.layers || []);
    // Theme membership gates rendering without changing the user's checkbox state.
    Object.entries(ctl.data).forEach(([sl, o]) => {
      const inTheme = all || (t.layers || []).includes(sl);
      o.theme(inTheme); o.el.hidden = !inTheme;
    });
    Object.entries(ctl.ov).forEach(([id, o]) => {
      const inTheme = all || (t.overlays || []).includes(id);
      o.theme(inTheme); o.el.hidden = !inTheme;
    });
    document.querySelectorAll('#legend .lgroup').forEach(g => {   // hide headings with nothing left under them
      g.hidden = ![...g.querySelectorAll('.lgbody > *')].some(e => !e.hidden);
    });
    populateSearchLayers();   // search only offers the theme's layers
  };
  sel.onchange = () => apply(sel.value);
  sel.value = CONFIG.defaultTheme || 0;
  apply(sel.value);
}
const inViewGroups = [];
function buildLegend() {
  inViewGroups.length = 0;
  const st = map.getStyle();
  const sourceLayers = [...new Set(st.layers.filter(l => l['source-layer']).map(l => l['source-layer']))];
  const groups = (st.metadata && st.metadata['mapsplat:legend-groups']) || [{ name: 'Layers', layers: sourceLayers }];
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
      const gchk = document.createElement('label');
      gchk.className = 'grp lname';
      gchk.innerHTML = `<input type="checkbox"${initialOn ? ' checked' : ''}> <span>${esc(sl.replace(/_/g, ' '))}</span><svg class="eye" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12z"/><circle cx="12" cy="12" r="3"/><line x1="3" y1="21" x2="21" y2="3"/></svg>`;
      const row = document.createElement('div');
      row.className = 'grprow';
      const tools = layerTools(0, (CONFIG.layerInfo || {})[sl], v => setTransparency(sl, v));
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
const overlayTileUrl = w => w.tiles || (/\/MapServer/i.test(w.url) ? arcgisTileUrl(w) : wmsTileUrl(w));
let originalStyleIds = null;
function validRasterEntries(entries, label, reserved = []) {
  const ids = new Set(reserved);
  return entries.filter(w => {
    if (!w || !w.id || (!w.url && !w.tiles)) { console.warn(`${label} skipped: needs id and url (or tiles)`, w); return false; }
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
function addRasterLayer(w, beforeId) {
  const tiles = Array.isArray(w.tiles) ? w.tiles : [overlayTileUrl(w)];
  const source = { type: 'raster', tileSize: w.tileSize || 256, tiles };
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
const hillshadeMax = () => (CONFIG.terrain || {}).hillshadeStrength ?? 0.6;
let terrainShadeStrength = hillshadeMax();
function allOverlays() {   // configured overlays + the built-in hillshade
  const list = validOverlays(), t = CONFIG.terrain;
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
  } else map.setPaintProperty(w.id, 'raster-opacity', 1 - v / 100);
};
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
      d.innerHTML = `<div class="grprow"><label class="lname"><input type="checkbox"${w.visible === true ? ' checked' : ''}> <span>${esc(w.name || w.id)}</span></label></div>`;
      const cb = d.querySelector('input');
      cb.onchange = () => setVis([w.id], cb.checked);
      if (!w.global) ctl.ov[w.id] = { theme: on => setThemeVisibility([w.id], on), el: d };
      const t = layerTools(transp, w.info ?? (CONFIG.layerInfo || {})[w.id], v => setOverlayTransparency(w, v));
      const rowEl = d.querySelector('.grprow');
      if (w.legendUrl) rowEl.prepend(collapser(d, CONFIG.collapseLayers)); else rowEl.insertAdjacentHTML('afterbegin', '<span class="cspace"></span>');
      if (t.infoBtn) rowEl.appendChild(t.infoBtn);
      rowEl.appendChild(t.btn);
      if (t.infoPanel) d.appendChild(t.infoPanel);
      d.appendChild(t.panel);
      if (w.legendUrl) d.insertAdjacentHTML('beforeend', `<img src="${esc(w.legendUrl)}" alt="" style="max-width:100%;margin:2px 0 4px 20px">`);
      body.appendChild(d);
      group.layerIds.add(w.id);
    });
    const hasTerrain = list.some(w => w.terrain);
    if (hasTerrain) group.onVisibilityChange = visible => {
      terrainGroupHidden = !visible;
      if (!visible && terrainOn) setTerrain3D(false, false);
      else if (visible && terrainCb && terrainCb.checked && !terrainOn) setTerrain3D(true, false);
    };
  });
}

function buildBasemapLegend() {
  const entries = validBasemaps();
  if (!entries.length) return;
  const group = addGroup($('legend'), 'Basemaps');
  entries.forEach(w => {
    const d = document.createElement('div');
    const visible = w.visible === true;
    d.innerHTML = `<div class="grprow"><label class="lname"><input type="checkbox"${visible ? ' checked' : ''}> <span>${esc(w.name || w.id)}</span></label></div>`;
    const cb = d.querySelector('input');
    cb.onchange = () => setVis([w.id], cb.checked);
    const transp = 100 - Math.round((w.opacity ?? 1) * 100);
    const tools = layerTools(transp, w.info ?? (CONFIG.layerInfo || {})[w.id], v => setOverlayTransparency(w, v));
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
  validBasemaps().forEach(w => addRasterLayer(w, (firstData || firstSymbol || {}).id));
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
      paint: { 'hillshade-exaggeration': terrainShadeStrength }
    }, firstData && firstData.id);
    if (tc.hillshade !== false) registerLayerVisibility('hillshade', tc.hillshadeVisible === true);
  } else $('terrainBtn').style.display = 'none';   // no DTM configured
  validOverlays().forEach(w => addRasterLayer(w, firstSymbol && firstSymbol.id));
  buildLegend();
  buildOverlayLegend();
  buildBasemapLegend();
  setupThemes();
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

function runSelection(a, b) {
  setBox(false);
  justBoxed = true; setTimeout(() => justBoxed = false, 50);   // stops the drag from also opening a popup
  if (Math.abs(a.x - b.x) < 3 && Math.abs(a.y - b.y) < 3) return;
  selected = queryData([[a.x, a.y], [b.x, b.y]]);
  showTable(selected, `${selected.length} record(s) selected`);
}

// ---------- Results panel ----------
let activeTab = null, ring = null, shown = [], tabRows = [], tabCols = [];
function centreOf(g) {
  const pts = [];
  (function walk(c) { typeof c[0] === 'number' ? pts.push(c) : c.forEach(walk); })(g.coordinates);
  const xs = pts.map(p => p[0]), ys = pts.map(p => p[1]);
  return [(Math.min(...xs) + Math.max(...xs)) / 2, (Math.min(...ys) + Math.max(...ys)) / 2];
}
function showTable(feats, label) {
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
    tabRows = []; tabCols = [];
  } else {
    $('tabs').innerHTML = names.map(n =>
      `<button class="tab${n === activeTab ? ' on' : ''}" data-tab="${esc(n)}">${esc(n.replace(/_/g, ' '))} (${groups[n].length})</button>`).join('');
    document.querySelectorAll('#tabs .tab').forEach(b => b.onclick = () => { activeTab = b.dataset.tab; showTable(feats, label); });
    tabRows = groups[activeTab];
    tabCols = [...new Set(tabRows.flatMap(f => Object.keys(f.properties)))];
    wrap.innerHTML = `<table><thead><tr>${tabCols.map(c => `<th>${esc(c)}</th>`).join('')}</tr></thead><tbody>` +
      tabRows.map((f, i) => `<tr data-i="${i}" title="Click to zoom to this record">${tabCols.map(c => `<td>${cell(f.properties[c])}</td>`).join('')}</tr>`).join('') +
      '</tbody></table>';
    wrap.querySelectorAll('tbody tr').forEach(tr => tr.onclick = ev => {
      if (ev.target.closest('a')) return;
      const f = tabRows[tr.dataset.i];
      if (!f.geometry) return;
      const c = centreOf(f.geometry);
      if (ring) ring.remove();
      const el = document.createElement('div'); el.className = 'ring';
      ring = new maplibregl.Marker({ element: el }).setLngLat(c).addTo(map);
      map.flyTo({ center: c, zoom: Math.max(map.getZoom(), 14) });
    });
  }
  document.body.classList.add('has-table');
}
function closeResults() {
  document.body.classList.remove('has-table');
  selected = []; shown = [];
  if (ring) { ring.remove(); ring = null; }
}
$('closeBtn').onclick = closeResults;
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
function setTerrainModel(id) {
  const model = terrainModels.find(m => m.id === id);
  if (!model || model === activeTerrainModel) return;
  const tc = CONFIG.terrain;
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
      paint: { 'hillshade-exaggeration': terrainShadeStrength }
    };
    if (terrainLayerBeforeId && map.getLayer(terrainLayerBeforeId)) map.addLayer(layer, terrainLayerBeforeId);
    else map.addLayer(layer);
  }
}
function setTerrain3D(on, syncCheckbox = true) {
  const tc = CONFIG.terrain;
  if (!tc || !activeTerrainModel || !map.getSource(activeTerrainModel.sourceId)) { if (terrainCb) terrainCb.checked = false; return toast('3D view needs a DTM configured in CONFIG.terrain.models.'); }
  terrainOn = on;
  if (terrainCb && syncCheckbox) terrainCb.checked = on;
  $('terrainBtn').classList.toggle('active', on);
  if (on) { map.setTerrain({ source: activeTerrainModel.sourceId, exaggeration: terrainExaggeration }); map.easeTo({ pitch: tc.pitch ?? 60, duration: 900 }); }
  else { map.setTerrain(null); map.easeTo({ pitch: 0, bearing: 0, duration: 600 }); }   // everything is draped on the surface automatically
}
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
