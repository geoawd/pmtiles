import assert from 'node:assert/strict';
import test from 'node:test';
import { isJsonThemeShareState, jsonThemeMapView, parseMapViewHash } from '../js/shared-links.js';

test('parses MapLibre zoom, latitude, and longitude hashes', () => {
  assert.deepEqual(parseMapViewHash('#8.00/54.221977/-6.081146'), {
    center: [-6.081146, 54.221977],
    zoom: 8,
    bearing: 0,
    pitch: 0
  });
});

test('parses optional MapLibre bearing and pitch and rejects invalid hashes', () => {
  assert.deepEqual(parseMapViewHash('#8/54/-6/24/35'), {
    center: [-6, 54],
    zoom: 8,
    bearing: 24,
    pitch: 35
  });
  assert.equal(parseMapViewHash('#not-a-map-view'), null);
  assert.equal(parseMapViewHash('#29/54/-6'), null);
  assert.equal(parseMapViewHash('#8/95/-6'), null);
});

test('recognizes JSON theme share state and extracts its map view', () => {
  const state = {
    search: {},
    range: {},
    dropdown: {},
    special: null,
    hiddenTabs: [],
    map: { lat: 54.221977, lng: -6.081146, zoom: 8 }
  };
  assert.equal(isJsonThemeShareState(state), true);
  assert.deepEqual(jsonThemeMapView(state), {
    center: [-6.081146, 54.221977],
    zoom: 8,
    bearing: 0,
    pitch: 0
  });
  assert.equal(isJsonThemeShareState({ map: {}, other: true }), false);
});
