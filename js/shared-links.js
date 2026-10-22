const numberPattern = /^-?\d+(?:\.\d+)?$/;

function validMapView(center, zoom, bearing = 0, pitch = 0) {
  return Array.isArray(center) && center.length === 2 && center.every(Number.isFinite) &&
    Math.abs(center[0]) <= 180 && Math.abs(center[1]) <= 85.051129 &&
    Number.isFinite(zoom) && zoom >= 0 && zoom <= 28 &&
    Number.isFinite(bearing) && Number.isFinite(pitch) && pitch >= 0 && pitch <= 80
    ? { center, zoom, bearing, pitch } : null;
}

export function parseMapViewHash(hash) {
  const parts = typeof hash === 'string' ? hash.replace(/^#/, '').split('/') : [];
  if (parts.length < 3 || parts.length > 5 || parts.some(part => !numberPattern.test(part))) return null;
  const [zoom, latitude, longitude, bearing = 0, pitch = 0] = parts.map(Number);
  return validMapView([longitude, latitude], zoom, bearing, pitch);
}

export function isJsonThemeShareState(state) {
  if (!state || typeof state !== 'object' || Array.isArray(state)) return false;
  return ['filters', 'search', 'range', 'dropdown', 'special', 'hiddenTabs']
    .some(key => Object.hasOwn(state, key));
}

export function jsonThemeMapView(state) {
  if (!isJsonThemeShareState(state) || !state.map || typeof state.map !== 'object') return null;
  const center = Array.isArray(state.map.center)
    ? state.map.center
    : [state.map.lng, state.map.lat];
  return validMapView(center, state.map.zoom);
}
