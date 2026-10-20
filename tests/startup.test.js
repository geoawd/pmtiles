import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const configLoaderSource = fs.readFileSync(path.join(root, 'js/config-loader.js'), 'utf8');
const stylesSource = fs.readFileSync(path.join(root, 'js/styles.js'), 'utf8');

function makeConfigLoaderBrowser(search = '') {
  const scripts = [];
  const alerts = [];
  const errors = [];
  const window = { location: { search } };
  const document = {
    createElement: tagName => ({
      tagName,
      style: {},
      setAttribute(name, value) {
        this[name] = value;
      }
    }),
    body: {
      appendChild: script => scripts.push(script),
      prepend: alert => alerts.push(alert)
    }
  };

  vm.runInNewContext(configLoaderSource, {
    window,
    document,
    URLSearchParams,
    console: { error: message => errors.push(message) }
  }, { filename: 'js/config-loader.js' });
  return { window, scripts, alerts, errors };
}

function makeStylesBrowser(config, fetch) {
  const scripts = [];
  const errors = [];
  let finishStartup;
  const startup = new Promise(resolve => { finishStartup = resolve; });
  const window = { CONFIG: config };
  const document = {
    createElement: tagName => ({ tagName }),
    body: {
      appendChild: script => {
        scripts.push(script);
        if (script.src === 'js/app.js') finishStartup('app');
      }
    }
  };

  vm.runInNewContext(stylesSource, {
    window,
    document,
    fetch,
    console: { error: (...args) => {
      errors.push(args);
      finishStartup('error');
    } }
  }, { filename: 'js/styles.js' });
  return { window, scripts, errors, startup };
}

function plain(value) {
  return JSON.parse(JSON.stringify(value));
}

test('config loader selects the requested profile and starts styles after config loads', async () => {
  const browser = makeConfigLoaderBrowser('?profile=internal');
  assert.equal(browser.window.CONFIG_PROFILE, 'internal');
  assert.deepEqual(browser.scripts.map(script => script.src), ['config/config.internal.js']);

  browser.window.CONFIG = { title: 'Internal profile' };
  browser.scripts[0].onload();
  await new Promise(resolve => setImmediate(resolve));

  assert.deepEqual(browser.scripts.map(script => script.src), [
    'config/config.internal.js',
    'js/styles.js'
  ]);
  assert.deepEqual(browser.errors, []);
  assert.deepEqual(browser.alerts, []);
});

test('config loader reports unknown profiles without loading scripts', () => {
  const browser = makeConfigLoaderBrowser('?profile=unknown');
  assert.deepEqual(browser.scripts, []);
  assert.equal(browser.alerts.length, 1);
  assert.equal(browser.alerts[0].role, 'alert');
  assert.match(browser.alerts[0].textContent, /Unknown configuration profile "unknown"/);
  assert.equal(browser.errors.length, 1);
});

test('config loader reports a missing config and does not start styles', async () => {
  const browser = makeConfigLoaderBrowser();
  browser.scripts[0].onload();
  await new Promise(resolve => setImmediate(resolve));

  assert.deepEqual(browser.scripts.map(script => script.src), ['config/config.js']);
  assert.equal(browser.alerts.length, 1);
  assert.match(browser.alerts[0].textContent, /did not define window\.CONFIG/);
});

test('config loader reports profile script network failures', async () => {
  const browser = makeConfigLoaderBrowser();
  browser.scripts[0].onerror();
  await new Promise(resolve => setImmediate(resolve));

  assert.deepEqual(browser.scripts.map(script => script.src), ['config/config.js']);
  assert.equal(browser.alerts.length, 1);
  assert.match(browser.alerts[0].textContent, /Could not start the public profile/);
  assert.match(browser.alerts[0].textContent, /Could not load config\/config\.js/);
});

test('styles merge datasets, rewrite sources, and hand off to the app module', async () => {
  const styleByPath = {
    'first-style.json': {
      version: 8,
      sources: { tiles: { type: 'vector', url: 'original-first' } },
      layers: [
        { id: 'background', type: 'background' },
        { id: 'shared', type: 'circle', source: 'tiles', 'source-layer': 'FirstLayer' }
      ],
      metadata: { 'mapsplat:legend-groups': [{ name: 'First group', layers: ['FirstLayer'] }] }
    },
    'second-style.json': {
      version: 8,
      sources: { tiles: { type: 'vector', url: 'original-second' } },
      layers: [
        { id: 'background', type: 'background' },
        { id: 'shared', type: 'circle', source: 'tiles', 'source-layer': 'SecondLayer' }
      ],
      metadata: { 'mapsplat:legend-groups': [{ name: 'Second group', layers: ['SecondLayer'] }] }
    }
  };
  const fetchCalls = [];
  const browser = makeStylesBrowser({
    datasets: [
      { id: 'first', style: 'first-style.json', pmtiles: 'first.pmtiles' },
      { id: 'second', style: 'second-style.json', pmtiles: 'second.pmtiles' }
    ]
  }, async url => {
    fetchCalls.push(url);
    return { ok: true, json: async () => styleByPath[url] };
  });

  assert.equal(await browser.startup, 'app');
  assert.deepEqual(fetchCalls, ['first-style.json', 'second-style.json']);
  assert.deepEqual(plain(browser.window.DATASET_SOURCES), {
    first: ['first__tiles'],
    second: ['second__tiles']
  });
  assert.deepEqual(plain(browser.window.DATASET_LAYERS), {
    first: ['FirstLayer'],
    second: ['SecondLayer']
  });
  assert.equal(browser.window.MAP_STYLE.sources.first__tiles.url, 'pmtiles://first.pmtiles');
  assert.equal(browser.window.MAP_STYLE.sources.second__tiles.url, 'pmtiles://second.pmtiles');
  assert.deepEqual(plain(browser.window.MAP_STYLE.layers.map(layer => layer.id)), [
    'background',
    'shared',
    'second__shared'
  ]);
  assert.equal(browser.window.MAP_STYLE.layers[2].source, 'second__tiles');
  assert.deepEqual(plain(browser.window.MAP_STYLE.metadata['mapsplat:legend-groups']), [
    { name: 'First group', layers: ['FirstLayer'] },
    { name: 'Second group', layers: ['SecondLayer'] }
  ]);
  assert.deepEqual(browser.scripts.map(script => ({
    src: script.src,
    type: script.type
  })), [{ src: 'js/app.js', type: 'module' }]);
  assert.deepEqual(browser.errors, []);
});

test('styles report failed dataset fetches and do not start the app', async () => {
  const browser = makeStylesBrowser({
    datasets: [{ id: 'broken', style: 'missing-style.json' }]
  }, async () => ({ ok: false, status: 404 }));

  assert.equal(await browser.startup, 'error');
  assert.equal(browser.scripts.length, 0);
  assert.equal(browser.errors.length, 1);
  assert.match(browser.errors[0][1].message, /missing-style\.json: 404/);
});
