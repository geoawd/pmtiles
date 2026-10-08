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

function splitWktParts(value) {
  const parts = [];
  let depth = 0;
  let start = 0;
  for (let index = 0; index < value.length; index += 1) {
    if (value[index] === '(') depth += 1;
    else if (value[index] === ')') depth -= 1;
    else if (value[index] === ',' && depth === 0) {
      parts.push(value.slice(start, index).trim());
      start = index + 1;
    }
    if (depth < 0) return null;
  }
  if (depth !== 0) return null;
  parts.push(value.slice(start).trim());
  return parts;
}

function unwrapWkt(value) {
  const text = value.trim();
  return text.startsWith('(') && text.endsWith(')') ? text.slice(1, -1).trim() : null;
}

function parseWktCoordinates(value) {
  const parts = splitWktParts(value);
  if (!parts?.length) return null;
  const coordinates = parts.map(part => {
    const values = part.split(/\s+/).map(Number);
    return values.length >= 2 && values.every(Number.isFinite) ? values.slice(0, 2) : null;
  });
  return coordinates.every(Boolean) ? coordinates : null;
}

function parseWktGeometry(value) {
  const match = value.match(/^\s*(POINT|LINESTRING|POLYGON)(?:\s+(?:ZM|Z|M))?\s*(\(.*\))\s*$/i);
  if (!match) return null;
  const type = match[1].toUpperCase() === 'LINESTRING' ? 'LineString' : match[1][0].toUpperCase() + match[1].slice(1).toLowerCase();
  const body = unwrapWkt(match[2]);
  if (body === null) return null;
  if (type === 'Point') {
    const coordinates = parseWktCoordinates(body);
    return coordinates?.length === 1 ? { type, coordinates: coordinates[0] } : null;
  }
  if (type === 'LineString') {
    const coordinates = parseWktCoordinates(body);
    return coordinates?.length >= 2 ? { type, coordinates } : null;
  }
  const rings = splitWktParts(body)?.map(part => {
    const ring = unwrapWkt(part);
    return ring === null ? null : parseWktCoordinates(ring);
  });
  return rings?.length && rings.every(ring => ring?.length >= 4)
    ? { type: 'Polygon', coordinates: rings }
    : null;
}

function collectGeometryPositions(coordinates, positions = []) {
  if (!Array.isArray(coordinates)) return positions;
  if (coordinates.length >= 2 && typeof coordinates[0] === 'number' && typeof coordinates[1] === 'number') {
    positions.push(coordinates);
  } else coordinates.forEach(child => collectGeometryPositions(child, positions));
  return positions;
}

function projectPosition(position, projection, config, projectionLibrary) {
  if (!Number.isFinite(position[0]) || !Number.isFinite(position[1])) return null;
  if (config.projectionDef && !projectionLibrary.defs(projection)) {
    projectionLibrary.defs(projection, config.projectionDef);
  }
  const coordinates = projectionLibrary(projection, 'WGS84', [position[0], position[1]]);
  return coordinates.every(Number.isFinite) && Math.abs(coordinates[0]) <= 180 && Math.abs(coordinates[1]) <= 85.051129
    ? [...coordinates, ...position.slice(2)]
    : null;
}

function projectCoordinateTree(coordinates, projection, config, projectionLibrary) {
  if (!Array.isArray(coordinates)) return null;
  if (coordinates.length >= 2 && typeof coordinates[0] === 'number' && typeof coordinates[1] === 'number') {
    return projectPosition(coordinates, projection, config, projectionLibrary);
  }
  const projected = coordinates.map(child => projectCoordinateTree(child, projection, config, projectionLibrary));
  return projected.every(Boolean) ? projected : null;
}

export function parseJsonGeometry(value, config, projectionLibrary) {
  let geometry;
  let projection = config.projection || 'EPSG:29902';
  if (typeof value === 'string') {
    const text = value.trim();
    if (text.startsWith('{')) {
      try { geometry = JSON.parse(text); } catch { return null; }
    } else geometry = parseWktGeometry(text);
  } else geometry = value;
  if (geometry?.type === 'Feature') geometry = geometry.geometry;
  if (!geometry || !['Point', 'LineString', 'Polygon', 'MultiPoint', 'MultiLineString', 'MultiPolygon'].includes(geometry.type)) return null;
  if (value && typeof value === 'object' || typeof value === 'string' && value.trim().startsWith('{')) {
    projection = config.geoJsonProjection || 'EPSG:4326';
  }
  const positions = collectGeometryPositions(geometry.coordinates);
  const minimumPositions = geometry.type === 'Point' || geometry.type === 'MultiPoint' ? 1 : geometry.type === 'LineString' || geometry.type === 'MultiLineString' ? 2 : 4;
  if (positions.length < minimumPositions) return null;
  const coordinates = projectCoordinateTree(geometry.coordinates, projection, config, projectionLibrary);
  return coordinates ? { type: geometry.type, coordinates } : null;
}

function geometryLines(geometry) {
  if (geometry.type === 'LineString') return [geometry.coordinates];
  if (geometry.type === 'MultiLineString' || geometry.type === 'Polygon') return geometry.coordinates;
  if (geometry.type === 'MultiPolygon') return geometry.coordinates.flat();
  return [];
}

function segmentIntersectsBounds(start, end, west, south, east, north) {
  const dx = end[0] - start[0];
  const dy = end[1] - start[1];
  let lower = 0;
  let upper = 1;
  for (const [p, q] of [[-dx, start[0] - west], [dx, east - start[0]], [-dy, start[1] - south], [dy, north - start[1]]]) {
    if (p === 0) {
      if (q < 0) return false;
      continue;
    }
    const ratio = q / p;
    if (p < 0) lower = Math.max(lower, ratio);
    else upper = Math.min(upper, ratio);
    if (lower > upper) return false;
  }
  return true;
}

function pointInRing(point, ring) {
  let inside = false;
  for (let current = 0, previous = ring.length - 1; current < ring.length; previous = current, current += 1) {
    const a = ring[current];
    const b = ring[previous];
    if ((a[1] > point[1]) !== (b[1] > point[1]) &&
        point[0] < ((b[0] - a[0]) * (point[1] - a[1])) / (b[1] - a[1]) + a[0]) inside = !inside;
  }
  return inside;
}

function polygonContainsPoint(polygon, point) {
  return polygon.length > 0 && pointInRing(point, polygon[0]) && !polygon.slice(1).some(ring => pointInRing(point, ring));
}

export function jsonGeometryIntersectsBounds(geometry, bounds) {
  const west = bounds.getWest();
  const south = bounds.getSouth();
  const east = bounds.getEast();
  const north = bounds.getNorth();
  const contains = position => position[0] >= west && position[0] <= east && position[1] >= south && position[1] <= north;
  const positions = collectGeometryPositions(geometry.coordinates);
  if (positions.some(contains)) return true;
  const corners = [[west, south], [east, south], [east, north], [west, north]];
  if (geometry.type === 'Polygon' && corners.some(point => polygonContainsPoint(geometry.coordinates, point))) return true;
  if (geometry.type === 'MultiPolygon' && corners.some(point => geometry.coordinates.some(polygon => polygonContainsPoint(polygon, point)))) return true;
  return geometryLines(geometry).some(line => {
    for (let index = 1; index < line.length; index += 1) {
      if (segmentIntersectsBounds(line[index - 1], line[index], west, south, east, north)) return true;
    }
    if (geometry.type.includes('Polygon') && line.length > 2 &&
        (line[0][0] !== line.at(-1)[0] || line[0][1] !== line.at(-1)[1])) {
      return segmentIntersectsBounds(line.at(-1), line[0], west, south, east, north);
    }
    return false;
  });
}

export function jsonGeometryCenter(geometry) {
  const positions = collectGeometryPositions(geometry.coordinates);
  if (!positions.length) return null;
  const longitudes = positions.map(position => position[0]);
  const latitudes = positions.map(position => position[1]);
  return [
    (Math.min(...longitudes) + Math.max(...longitudes)) / 2,
    (Math.min(...latitudes) + Math.max(...latitudes)) / 2
  ];
}

export function buildJsonFeatures(rows, config, projectionLibrary) {
  return rows.flatMap(row => {
    const geometry = parseJsonGeometry(row[config.geometryField], config, projectionLibrary);
    if (!geometry) return [];
    return [{
      type: 'Feature',
      id: String(row[config.linkField]),
      geometry,
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
