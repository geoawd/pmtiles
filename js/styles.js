// Builds the map style from CONFIG.datasets (one .pmtiles + style.json each), then starts app.js.
(async () => {
  const C = window.CONFIG;
  const datasets = C.datasets && C.datasets.length ? C.datasets : null;
  window.DATASET_LAYERS = {};
  if (datasets) {
    const styles = await Promise.all(datasets.map(d => fetch(d.style || C.styleUrl).then(r => {
      if (!r.ok) throw new Error(`${d.style || C.styleUrl}: ${r.status}`);
      return r.json();
    })));
    const multi = datasets.length > 1;
    const merged = { version: 8, sources: {}, layers: [], metadata: {} };
    const usedIds = new Set(), groups = [];
    datasets.forEach((d, i) => {
      const s = styles[i], rename = {};
      ['glyphs', 'sprite', 'name'].forEach(k => { if (merged[k] === undefined && s[k] !== undefined) merged[k] = s[k]; });
      Object.entries(s.sources || {}).forEach(([name, src]) => {
        const id = multi ? `${d.id}__${name}` : name;
        rename[name] = id;
        merged.sources[id] = src.type === 'vector' && d.pmtiles ? { ...src, url: 'pmtiles://' + d.pmtiles } : src;
      });
      const names = new Set();
      s.layers.forEach(l => {
        if (l.type === 'background' && i > 0) return;
        const id = usedIds.has(l.id) ? `${d.id}__${l.id}` : l.id;
        usedIds.add(id);
        merged.layers.push({ ...l, id, ...(l.source ? { source: rename[l.source] || l.source } : {}) });
        if (l['source-layer']) names.add(l['source-layer']);
      });
      window.DATASET_LAYERS[d.id] = [...names];
      const g = s.metadata && s.metadata['mapsplat:legend-groups'];
      if (g) groups.push(...g);
      else if (multi) groups.push({ name: d.name || d.id, layers: [...names] });
    });
    if (groups.length) merged.metadata['mapsplat:legend-groups'] = groups;
    window.MAP_STYLE = merged;
  }
  const script = document.createElement('script');
  script.type = 'module';
  script.src = 'js/app.js';
  document.body.appendChild(script);
})().catch(e => console.error('Could not load map styles:', e));
