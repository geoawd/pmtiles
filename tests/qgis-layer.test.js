import assert from 'node:assert/strict';
import test from 'node:test';
import { buildQgisLayerDefinition, QGIS_TURBO_COLORS } from '../js/qgis-layer.js';

test('QGIS layer definition embeds an escaped GDAL source and raster color style', () => {
  const qlr = buildQgisLayerDefinition({
    id: 'elevation & surface',
    name: 'Ardquin DSM',
    url: 'https://example.org/Ardquin%20DSM.tif?token=a&format=cog',
    opacity: 0.6,
    minimum: 0,
    maximum: 100,
    colorStops: [
      { value: 0, color: '#30123b', label: 'Low < 0' },
      { value: 100, color: '#7a0403', label: 'High' }
    ]
  });

  assert.match(qlr, /<!DOCTYPE qgis-layer-definition>/);
  assert.match(qlr, /<layer-tree-layer checked="Qt::Checked"[^>]*id="elevation_surface"[^>]*name="Ardquin DSM"/);
  assert.match(qlr, /<datasource>\/vsicurl\/https:\/\/example\.org\/Ardquin%20DSM\.tif\?token=a&amp;format=cog<\/datasource>/);
  assert.match(qlr, /<authid>EPSG:29902<\/authid>/);
  assert.match(qlr, /type="singlebandpseudocolor"/);
  assert.match(qlr, /classificationMax="100" classificationMin="0"/);
  assert.match(qlr, /color="#30123b" label="Low &lt; 0"/);
  assert.equal((qlr.match(/<rastershader>/g) || []).length, 1);
});

test('QGIS layer definition emits discrete class breaks and validates input', () => {
  const qlr = buildQgisLayerDefinition({
    id: 'soil',
    name: 'Soil',
    url: 'https://example.org/soil.tif',
    minimum: 0,
    maximum: 20,
    discrete: true,
    colorStops: [
      { value: 10, color: '#000000', label: 'First class' },
      { value: 20, color: '#ffffff', label: 'Second class' }
    ]
  });

  assert.match(qlr, /colorRampType="DISCRETE"/);
  assert.match(qlr, /classificationMode="1"/);
  assert.match(qlr, /label="First class" value="10"/);
  assert.throws(() => buildQgisLayerDefinition({
    id: 'invalid', name: 'Invalid', url: 'file:///tmp/raster.tif'
  }), /HTTP or HTTPS/);
  assert.throws(() => buildQgisLayerDefinition({
    id: 'invalid', name: 'Invalid', url: 'https://example.org/a.tif',
    minimum: 0, maximum: 10, colorStops: [{ value: 1, color: 'red' }]
  }), /increasing values and six-digit hex colors/);
});

test('QGIS export can fall back to a single-band gray renderer', () => {
  const qlr = buildQgisLayerDefinition({
    id: 'gray-raster',
    name: 'Gray raster',
    url: 'https://example.org/gray.tif',
    opacity: 0.8,
    minimum: -10,
    maximum: 30,
    colorStops: []
  });
  assert.match(qlr, /type="singlebandgray"/);
  assert.match(qlr, /grayBand="1"/);
  assert.match(qlr, /<algorithm>StretchToMinimumMaximum<\/algorithm>/);
});

test('QGIS Turbo fallback provides a ramp of control colors', () => {
  assert.ok(QGIS_TURBO_COLORS.length > 2);
  assert.equal(QGIS_TURBO_COLORS[0], '#30123b');
  assert.equal(QGIS_TURBO_COLORS.at(-1), '#7a0403');
});
