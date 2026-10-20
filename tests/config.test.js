import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const configPath = path.join(root, 'config/config.js');
const configWindow = {};
vm.runInNewContext(fs.readFileSync(configPath, 'utf8'), { window: configWindow }, {
  filename: configPath
});

const config = configWindow.CONFIG;

function readStyle(relativePath) {
  return JSON.parse(fs.readFileSync(path.resolve(root, relativePath), 'utf8'));
}

function assertUniqueIds(items, label) {
  const ids = items.map(item => item.id);
  assert.ok(ids.every(id => typeof id === 'string' && id.length > 0), `${label} must have IDs`);
  assert.equal(new Set(ids).size, ids.length, `${label} IDs must be unique`);
}

function assertReferencesExist(references, knownReferences, label) {
  for (const reference of references || []) {
    assert.ok(knownReferences.has(reference), `${label} references unknown "${reference}"`);
  }
}

test('application configuration has valid defaults and project bounds', () => {
  assert.ok(config && typeof config === 'object', 'config/config.js must define window.CONFIG');
  assert.equal(typeof config.title, 'string');
  assert.ok(config.title.trim().length > 0);
  assert.ok(Array.isArray(config.themes) && config.themes.length > 0);
  assert.ok(Number.isInteger(config.defaultTheme));
  assert.ok(config.defaultTheme >= 0 && config.defaultTheme < config.themes.length);

  assert.ok(Array.isArray(config.bounds) && config.bounds.length === 2);
  for (const coordinate of config.bounds.flat()) {
    assert.ok(Number.isFinite(coordinate));
  }
  assert.ok(config.bounds[0][0] < config.bounds[1][0], 'west bound must be west of east bound');
  assert.ok(config.bounds[0][1] < config.bounds[1][1], 'south bound must be south of north bound');
});

test('configured datasets, basemaps, overlays, and terrain models have unique IDs', () => {
  for (const [label, items] of [
    ['datasets', config.datasets],
    ['basemaps', config.basemaps],
    ['overlays', config.overlays],
    ['terrain models', config.terrain?.models || []]
  ]) {
    assert.ok(Array.isArray(items), `${label} must be an array`);
    assertUniqueIds(items, label);
  }
});

test('configured raster and tile sources have valid source settings', () => {
  for (const basemap of config.basemaps) {
    assert.equal(typeof basemap.tiles, 'string', `basemap "${basemap.id}" must define tiles`);
    assert.ok(basemap.tiles.startsWith('https://'), `basemap "${basemap.id}" must use HTTPS`);
  }

  for (const overlay of config.overlays) {
    const sourceFields = ['cog', 'tiles', 'url', 'geojson'].filter(field => overlay[field] !== undefined);
    assert.equal(sourceFields.length, 1, `overlay "${overlay.id}" must define exactly one source`);
    assert.equal(typeof overlay[sourceFields[0]], 'string',
      `overlay "${overlay.id}" source must be a string`);
    if (sourceFields[0] !== 'geojson') {
      assert.ok(overlay[sourceFields[0]].length > 0, `overlay "${overlay.id}" source must not be empty`);
    }

    if (overlay.opacity !== undefined) {
      assert.ok(Number.isFinite(overlay.opacity) && overlay.opacity >= 0 && overlay.opacity <= 1,
        `overlay "${overlay.id}" opacity must be between 0 and 1`);
    }
    if (overlay.visible !== undefined) {
      assert.equal(typeof overlay.visible, 'boolean', `overlay "${overlay.id}" visible must be boolean`);
    }
    if (overlay.tileSize !== undefined) {
      assert.ok(Number.isInteger(overlay.tileSize) && overlay.tileSize > 0,
        `overlay "${overlay.id}" tileSize must be a positive integer`);
    }
    if (overlay.minzoom !== undefined && overlay.maxzoom !== undefined) {
      assert.ok(overlay.minzoom <= overlay.maxzoom,
        `overlay "${overlay.id}" minzoom must not exceed maxzoom`);
    }
  }

  for (const model of config.terrain?.models || []) {
    assert.equal(typeof model.cog, 'string', `terrain model "${model.id}" must define a COG`);
    assert.ok(model.cog.length > 0, `terrain model "${model.id}" COG must not be empty`);
    if (model.tileSize !== undefined) {
      assert.ok(Number.isInteger(model.tileSize) && model.tileSize > 0,
        `terrain model "${model.id}" tileSize must be a positive integer`);
    }
  }
});

test('local styles and their sources are valid and available', () => {
  const stylePaths = [config.styleUrl, ...config.datasets.map(dataset => dataset.style)];
  const styles = stylePaths.map(stylePath => ({ path: stylePath, style: readStyle(stylePath) }));

  for (const { path: stylePath, style } of styles) {
    assert.ok(Array.isArray(style.layers), `${stylePath} must define layers`);
    const layerIds = style.layers.map(layer => layer.id);
    assert.ok(layerIds.every(id => typeof id === 'string' && id.length > 0),
      `${stylePath} layers must have IDs`);
    assert.equal(new Set(layerIds).size, layerIds.length, `${stylePath} layer IDs must be unique`);

    const sourceIds = new Set(Object.keys(style.sources || {}));
    for (const layer of style.layers) {
      if (layer.type === 'background') {
        assert.equal(layer.source, undefined,
          `${stylePath} background layer "${layer.id}" must not reference a source`);
        continue;
      }
      assert.ok(sourceIds.has(layer.source), `${stylePath} layer "${layer.id}" uses unknown source "${layer.source}"`);
      if (layer['source-layer']) {
        assert.equal(style.sources[layer.source].type, 'vector',
          `${stylePath} layer "${layer.id}" uses source-layer on a non-vector source`);
      }
    }

    for (const source of Object.values(style.sources || {})) {
      const sourceUrl = source.url;
      if (typeof sourceUrl === 'string' && sourceUrl.startsWith('pmtiles://')) {
        const localPath = sourceUrl.slice('pmtiles://'.length).split('?')[0];
        assert.ok(fs.existsSync(path.resolve(root, decodeURIComponent(localPath))),
          `${stylePath} references missing PMTiles archive "${localPath}"`);
      }
    }
  }

  for (const dataset of config.datasets) {
    if (dataset.pmtiles) {
      assert.ok(fs.existsSync(path.resolve(root, dataset.pmtiles)),
        `dataset "${dataset.id}" references missing PMTiles archive "${dataset.pmtiles}"`);
    }
  }
});

test('themes and named groups reference configured layers, datasets, and overlays', () => {
  const activeStylePaths = config.datasets.length
    ? config.datasets.map(dataset => dataset.style || config.styleUrl)
    : [config.styleUrl];
  const activeStyles = activeStylePaths.map(readStyle);
  const allStyles = [config.styleUrl, ...config.datasets.map(dataset => dataset.style)]
    .filter(Boolean)
    .map(readStyle);
  const vectorLayers = new Set(activeStyles.flatMap(style =>
    style.layers.map(layer => layer['source-layer']).filter(Boolean)
  ));
  const datasetIds = new Set(config.datasets.map(dataset => dataset.id));
  const overlayIds = new Set(config.overlays.map(overlay => overlay.id));
  const overlayGroups = new Set(config.overlays.map(overlay => overlay.group).filter(Boolean));
  const styleGroups = new Set(allStyles.flatMap(style =>
    (style.metadata?.['mapsplat:legend-groups'] || []).map(group => group.name)
  ));
  const themeNames = new Set(config.themes.map(theme => theme.name));
  const configuredGroups = config.groups || {};
  const knownGroupNames = new Set([
    ...Object.keys(configuredGroups),
    ...overlayGroups,
    ...styleGroups,
    ...themeNames
  ]);
  const validOverlayReferences = new Set([...overlayIds, ...overlayGroups]);

  const themeNamesList = [...themeNames];
  assert.ok(themeNamesList.every(name => typeof name === 'string' && name.trim().length > 0));
  assert.equal(themeNames.size, config.themes.length, 'theme names must be unique');

  for (const theme of config.themes) {
    assertReferencesExist(theme.layers, vectorLayers, `theme "${theme.name}" layers`);
    assertReferencesExist(theme.datasets, datasetIds, `theme "${theme.name}" datasets`);
    assertReferencesExist(theme.overlays, validOverlayReferences, `theme "${theme.name}" overlays`);
    assertReferencesExist(theme.groups, knownGroupNames, `theme "${theme.name}" groups`);
  }

  for (const [name, group] of Object.entries(configuredGroups)) {
    assertReferencesExist(group.layers, vectorLayers, `group "${name}" layers`);
    assertReferencesExist(group.datasets, datasetIds, `group "${name}" datasets`);
    assertReferencesExist(group.overlays, overlayIds, `group "${name}" overlays`);
    assertReferencesExist(group.groups, knownGroupNames, `group "${name}" groups`);
  }

  for (const layerName of Object.keys(config.layerInfo || {})) {
    assert.ok(vectorLayers.has(layerName) || overlayIds.has(layerName),
      `layerInfo references unknown layer or overlay "${layerName}"`);
  }
  for (const groupName of Object.keys(config.groupInfo || {})) {
    assert.ok(knownGroupNames.has(groupName),
      `groupInfo references unknown group "${groupName}"`);
  }
  for (const layerName of Object.keys(config.dataLinks || {})) {
    assert.ok(vectorLayers.has(layerName), `dataLinks references unknown vector layer "${layerName}"`);
  }
});
