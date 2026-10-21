import assert from 'node:assert/strict';
import test from 'node:test';
import { cogResamplingUrl } from '../js/cog-resampling.js';

test('COG resampling appends protocol parameters to base and styled source URLs', () => {
  assert.equal(
    cogResamplingUrl('cog://https://example.org/raster.tif', 'bilinear'),
    'cog://https://example.org/raster.tif#&resampling=bilinear'
  );
  assert.equal(
    cogResamplingUrl('cog://https://example.org/raster.tif#color=palette,0,100,c', 'nearest'),
    'cog://https://example.org/raster.tif#color=palette,0,100,c&resampling=nearest'
  );
  assert.equal(cogResamplingUrl('cog://https://example.org/raster.tif', undefined),
    'cog://https://example.org/raster.tif');
});

test('COG resampling rejects unsupported methods', () => {
  assert.throws(() => cogResamplingUrl('cog://raster.tif', 'cubic'), /nearest.*bilinear/);
});
