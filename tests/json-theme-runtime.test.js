import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { pathToFileURL } from 'node:url';
import {
  buildJsonFeatures,
  createJsonThemeState,
  filterJsonRows,
  hasJsonFilters,
  jsonGeometryCenter,
  jsonGeometryIntersectsBounds,
  loadJsonThemeConfig,
  loadJsonThemeData,
  parseJsonGeometry
} from '../js/json-theme-runtime.js';

const identityProjection = (source, destination, coordinates) => coordinates;
identityProjection.defs = () => undefined;

function makeBounds(west, south, east, north) {
  return {
    getWest: () => west,
    getSouth: () => south,
    getEast: () => east,
    getNorth: () => north
  };
}

test('JSON theme state initializes independent collections and filter buckets', () => {
  const state = createJsonThemeState();
  assert.equal(state.active, false);
  assert.equal(state.loaded, false);
  assert.deepEqual(state.features, []);
  assert.deepEqual([...state.featureById], []);
  assert.deepEqual([...state.geometryPropertiesById], []);
  assert.deepEqual([...state.hiddenTabs], []);
  assert.deepEqual([...state.boundedIds], []);
  assert.deepEqual([...state.baseIds], []);
  assert.deepEqual([...state.finalIds], []);
  assert.deepEqual(state.filters, { text: {}, range: {}, operators: {}, dropdown: {} });

  state.hiddenTabs.add('details');
  assert.equal(createJsonThemeState().hiddenTabs.has('details'), false);
});

test('loads JSON theme config modules and rejects missing or mismatched config', async () => {
  await assert.rejects(
    loadJsonThemeConfig({ jsonTheme: 'sample' }, 'https://viewer.test/'),
    /require jsonTheme and jsonConfig/
  );

  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'mapviewer-theme-'));
  const configPath = path.join(directory, 'theme-config.js');
  fs.writeFileSync(configPath, 'export default { id: "sample", tabs: [] };');
  try {
    const theme = { jsonTheme: 'sample', jsonConfig: configPath };
    const baseUrl = pathToFileURL(path.join(directory, 'index.html')).href;
    const first = await loadJsonThemeConfig(theme, baseUrl);
    const second = await loadJsonThemeConfig(theme, baseUrl);
    assert.equal(first.id, 'sample');
    assert.equal(first, second);
    await assert.rejects(
      loadJsonThemeConfig({ jsonTheme: 'other', jsonConfig: configPath }, baseUrl),
      /ID mismatch/
    );
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

test('JSON theme data requires exactly one primary tab', async () => {
  await assert.rejects(loadJsonThemeData({ tabs: [] }, 'https://viewer.test/'), /exactly one primary tab/);
  await assert.rejects(loadJsonThemeData({
    tabs: [{ key: 'one', isPrimary: true }, { key: 'two', isPrimary: true }]
  }, 'https://viewer.test/'), /exactly one primary tab/);
});

test('loads tab arrays, labels related rows, and reports failed tab requests', async t => {
  const originalFetch = globalThis.fetch;
  const requests = [];
  globalThis.fetch = async url => {
    const href = String(url);
    requests.push(href);
    if (href.endsWith('/primary.json')) {
      return new Response(JSON.stringify({ records: [
        { id: 7, name: 'Primary label' },
        { id: 8, name: 'Second label' }
      ] }), { status: 200 });
    }
    if (href.endsWith('/related.json')) {
      return new Response(JSON.stringify({ rows: [
        { id: 7, value: 'joined' },
        { id: 99, value: 'orphan' }
      ] }), { status: 200 });
    }
    if (href.endsWith('/failed.json')) return new Response('not found', { status: 404 });
    if (href.endsWith('/deployments.json')) return new Response(JSON.stringify([{ id: 'd1' }]), { status: 200 });
    if (href.endsWith('/links.json')) return new Response(JSON.stringify({ invalid: true }), { status: 200 });
    throw new Error(`Unexpected request: ${href}`);
  };
  t.after(() => { globalThis.fetch = originalFetch; });

  const result = await loadJsonThemeData({
    dataDirectory: 'records/',
    linkField: 'id',
    labelField: 'name',
    tabs: [
      { key: 'primary', file: 'primary.json', dataKey: 'records', isPrimary: true },
      { key: 'related', file: 'related.json', dataKey: 'rows' },
      { key: 'failed', file: 'failed.json', dataKey: 'rows' }
    ],
    deploymentsFile: 'deployments.json',
    deploymentLinksFile: 'links.json'
  }, 'https://viewer.test/app/');

  assert.deepEqual(result.rows.primary, [
    { id: 7, name: 'Primary label' },
    { id: 8, name: 'Second label' }
  ]);
  assert.deepEqual(result.rows.related, [
    { name: 'Primary label', id: 7, value: 'joined' },
    { name: '\u2014', id: 99, value: 'orphan' }
  ]);
  assert.deepEqual(result.rows.failed, []);
  assert.deepEqual(result.errors, { failed: 'HTTP 404' });
  assert.deepEqual(result.deployments, [{ id: 'd1' }]);
  assert.deepEqual(result.deploymentLinks, []);
  assert.ok(requests.includes('https://viewer.test/app/records/primary.json'));
});

test('parses and projects supported WKT and GeoJSON geometry', () => {
  const config = { projection: 'EPSG:29902', geoJsonProjection: 'EPSG:4326' };
  assert.deepEqual(parseJsonGeometry('POINT (1 2)', config, identityProjection), {
    type: 'Point',
    coordinates: [1, 2]
  });
  assert.deepEqual(parseJsonGeometry('LINESTRING (0 0, 2 3, 4 5)', config, identityProjection), {
    type: 'LineString',
    coordinates: [[0, 0], [2, 3], [4, 5]]
  });
  assert.deepEqual(parseJsonGeometry('POLYGON ((0 0, 4 0, 4 4, 0 4, 0 0))', config, identityProjection), {
    type: 'Polygon',
    coordinates: [[[0, 0], [4, 0], [4, 4], [0, 4], [0, 0]]]
  });
  assert.deepEqual(parseJsonGeometry(JSON.stringify({
    type: 'Feature',
    geometry: { type: 'Point', coordinates: [5, 6, 10] },
    properties: {}
  }), config, identityProjection), {
    type: 'Point',
    coordinates: [5, 6, 10]
  });
});

test('rejects malformed, unsupported, and out-of-range geometry', () => {
  const config = { projection: 'EPSG:4326', geoJsonProjection: 'EPSG:4326' };
  for (const value of [
    'POINT (bad 2)',
    'LINESTRING (1 2)',
    'POLYGON ((0 0, 1 0, 1 1))',
    'MULTIPOINT ((0 0))',
    '{"type":"Point",broken}',
    { type: 'Point', coordinates: [181, 0] },
    { type: 'GeometryCollection', geometries: [] }
  ]) {
    assert.equal(parseJsonGeometry(value, config, identityProjection), null, String(value));
  }
});

test('builds map features with stable string IDs and skips invalid geometry', () => {
  const rows = [
    { id: 42, geometry: 'POINT (1 2)', label: 'valid' },
    { id: 43, geometry: 'POINT (invalid 2)', label: 'invalid' }
  ];
  assert.deepEqual(buildJsonFeatures(rows, {
    geometryField: 'geometry',
    linkField: 'id',
    projection: 'EPSG:4326'
  }, identityProjection), [{
    type: 'Feature',
    id: '42',
    geometry: { type: 'Point', coordinates: [1, 2] },
    properties: rows[0]
  }]);
});

test('finds geometry intersections with bounds and returns geometry centers', () => {
  const bounds = makeBounds(0, 0, 2, 2);
  assert.equal(jsonGeometryIntersectsBounds({ type: 'Point', coordinates: [1, 1] }, bounds), true);
  assert.equal(jsonGeometryIntersectsBounds({ type: 'Point', coordinates: [3, 3] }, bounds), false);
  assert.equal(jsonGeometryIntersectsBounds({
    type: 'LineString',
    coordinates: [[-1, 1], [3, 1]]
  }, bounds), true);
  assert.equal(jsonGeometryIntersectsBounds({
    type: 'Polygon',
    coordinates: [[[-1, -1], [3, -1], [3, 3], [-1, 3], [-1, -1]]]
  }, bounds), true);
  assert.equal(jsonGeometryIntersectsBounds({
    type: 'Polygon',
    coordinates: [[[3, 3], [4, 3], [4, 4], [3, 4], [3, 3]]]
  }, bounds), false);

  assert.deepEqual(jsonGeometryCenter({
    type: 'MultiPoint',
    coordinates: [[-2, 1], [4, 5]]
  }), [1, 3]);
  assert.equal(jsonGeometryCenter({ type: 'Point', coordinates: [] }), null);
});

test('combines text, range, and dropdown filters and supports excluding a field', () => {
  const rows = [
    { name: 'Northern Ireland', depth: 12, type: 'borehole' },
    { name: 'Ireland', depth: 4, type: 'site' },
    { name: 'Scotland', depth: 20, type: 'borehole' }
  ];
  const filters = {
    text: { primary: { name: 'ire' } },
    range: { primary: { depth: '10' } },
    operators: { primary: { depth: 'gte' } },
    dropdown: { primary: { type: ['borehole'] } }
  };
  const config = { rangeFilterColumns: {} };
  assert.deepEqual(filterJsonRows(rows, 'primary', filters, config), [rows[0]]);
  assert.deepEqual(filterJsonRows(rows, 'primary', filters, config, 'name'), [rows[0], rows[2]]);
  assert.equal(hasJsonFilters(filters, 'primary'), true);
  assert.equal(hasJsonFilters(filters, 'primary', 'name'), true);
  assert.equal(hasJsonFilters({
    text: { primary: { name: '' } },
    range: { primary: { depth: 'not-a-number' } },
    dropdown: { primary: { type: [] } }
  }, 'primary'), false);
});
