const jsonThemeConfigPromises = new Map();

export function loadJsonThemeConfig(theme, baseUrl = location.href) {
  const themeId = theme?.jsonTheme;
  const configPath = theme?.jsonConfig;
  if (typeof themeId !== 'string' || !themeId || typeof configPath !== 'string' || !configPath) {
    return Promise.reject(new Error('JSON themes require jsonTheme and jsonConfig settings.'));
  }
  const key = `${themeId}|${new URL(configPath, baseUrl).href}`;
  if (!jsonThemeConfigPromises.has(key)) {
    jsonThemeConfigPromises.set(key, import(new URL(configPath, baseUrl).href).then(module => {
      if (!module.default || typeof module.default !== 'object') throw new Error(`Invalid JSON theme config: ${configPath}`);
      if (module.default.id && module.default.id !== themeId) throw new Error(`JSON theme config ID mismatch: ${configPath}`);
      return module.default;
    }).catch(error => {
      jsonThemeConfigPromises.delete(key);
      throw error;
    }));
  }
  return jsonThemeConfigPromises.get(key);
}

export function createJsonThemeState() {
  return {
    active: false,
    loaded: false,
    loading: null,
    rows: {},
    features: [],
    featureById: new Map(),
    errors: {},
    tab: null,
    hiddenTabs: new Set(),
    boundedIds: new Set(),
    baseIds: new Set(),
    finalIds: new Set(),
    visibleRows: {},
    filters: { text: {}, range: {}, operators: {}, dropdown: {} },
    specialFilter: null,
    linkedVisible: true,
    openDropdown: null,
    dropdownSearch: {},
    filterFocus: null,
    filterSelection: null,
    panelManuallySized: false,
    depthGroup: null,
    linkedGroup: null,
    sort: {},
    panelClosed: false,
    stateRestored: false,
    deployments: [],
    deploymentLinks: []
  };
}

export async function loadJsonThemeData(config, baseUrl = location.href) {
  const primaryTabs = config.tabs.filter(tab => tab.isPrimary);
  if (primaryTabs.length !== 1) throw new Error('JSON theme config must declare exactly one primary tab.');

  const results = [];
  const errors = {};
  for (let start = 0; start < config.tabs.length; start += 3) {
    const batch = await Promise.all(config.tabs.slice(start, start + 3).map(async tab => {
      try {
        const url = new URL(tab.file, new URL(config.dataDirectory, baseUrl));
        const response = await fetch(url);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const payload = await response.json();
        if (!Array.isArray(payload[tab.dataKey])) throw new Error(`Missing array: ${tab.dataKey}`);
        return [tab.key, payload[tab.dataKey]];
      } catch (error) {
        errors[tab.key] = error.message;
        return [tab.key, []];
      }
    }));
    results.push(...batch);
  }

  const rows = Object.fromEntries(results);
  const primary = primaryTabs[0];
  const labels = new Map((rows[primary.key] || []).map(row => [row[config.linkField], row[config.labelField]]));
  config.tabs.filter(tab => !tab.isPrimary).forEach(tab => {
    rows[tab.key] = (rows[tab.key] || []).map(row => ({
      [config.labelField]: labels.get(row[config.linkField]) || '\u2014', ...row
    }));
  });

  const fetchOptionalArray = async path => {
    if (!path) return [];
    try {
      const response = await fetch(new URL(path, baseUrl));
      if (!response.ok) return [];
      const value = await response.json();
      return Array.isArray(value) ? value : [];
    } catch {
      return [];
    }
  };
  const [deployments, deploymentLinks] = await Promise.all([
    fetchOptionalArray(config.deploymentsFile),
    fetchOptionalArray(config.deploymentLinksFile)
  ]);

  return { rows, errors, deployments, deploymentLinks };
}

export function parseJsonPoint(wkt, config, projectionLibrary) {
  const match = typeof wkt === 'string' && wkt.match(/^\s*POINT\s*\(\s*(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)\s*\)\s*$/i);
  if (!match) return null;
  const projection = config.projection || 'EPSG:29902';
  if (config.projectionDef && !projectionLibrary.defs(projection)) {
    projectionLibrary.defs(projection, config.projectionDef);
  }
  const coordinates = projectionLibrary(projection, 'WGS84', [Number(match[1]), Number(match[2])]);
  return coordinates.every(Number.isFinite) && Math.abs(coordinates[0]) <= 180 && Math.abs(coordinates[1]) <= 85.051129
    ? coordinates
    : null;
}

export function buildJsonPointFeatures(rows, config, projectionLibrary) {
  return rows.flatMap(row => {
    const coordinates = parseJsonPoint(row[config.geometryField], config, projectionLibrary);
    if (!coordinates) return [];
    return [{
      type: 'Feature',
      id: String(row[config.linkField]),
      geometry: { type: 'Point', coordinates },
      properties: row
    }];
  });
}

export function hasJsonFilters(filters, tabKey, exceptField = null) {
  return Object.entries(filters.text[tabKey] || {}).some(([field, value]) => field !== exceptField && value) ||
    Object.entries(filters.range[tabKey] || {}).some(([field, value]) => field !== exceptField && value !== '' && Number.isFinite(Number(value))) ||
    Object.entries(filters.dropdown[tabKey] || {}).some(([field, values]) => field !== exceptField && values?.length);
}

export function filterJsonRows(rows, tabKey, filters, config, exceptField = null) {
  const text = filters.text[tabKey] || {};
  const range = filters.range[tabKey] || {};
  const operators = filters.operators[tabKey] || {};
  const dropdown = filters.dropdown[tabKey] || {};
  return rows.filter(row => {
    for (const [field, query] of Object.entries(text)) {
      if (field !== exceptField && query && !String(row[field] ?? '').toLowerCase().includes(query.toLowerCase())) return false;
    }
    for (const [field, threshold] of Object.entries(range)) {
      if (field === exceptField || threshold === '' || !Number.isFinite(Number(threshold))) continue;
      const value = Number(row[field]);
      if (!Number.isFinite(value)) return false;
      const operator = operators[field] || config.rangeFilterColumns[field];
      if (operator === 'gte' ? value < Number(threshold) : value > Number(threshold)) return false;
    }
    for (const [field, values] of Object.entries(dropdown)) {
      if (field !== exceptField && values?.length && !values.includes(String(row[field] ?? ''))) return false;
    }
    return true;
  });
}
