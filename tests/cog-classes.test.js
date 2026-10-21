import assert from 'node:assert/strict';
import test from 'node:test';
import { cogClassColorLut, cogClassRampColors, validateCogClasses } from '../js/cog-classes.js';

test('COG class breaks require increasing finite limits and valid optional labels', () => {
  assert.deepEqual(validateCogClasses([
    { max: 50, label: '2nd percentile' },
    { max: 100 }
  ]), [
    { max: 50, label: '2nd percentile' },
    { max: 100 }
  ]);
  assert.throws(() => validateCogClasses([]), /at least one class break/);
  assert.throws(() => validateCogClasses([{ max: 50 }, { max: 50 }]), /greater than the previous/);
  assert.throws(() => validateCogClasses([{ max: NaN }]), /finite max/);
  assert.throws(() => validateCogClasses([{ max: 50, label: ' ' }]), /non-empty string/);
});

test('COG class colors span the selected ramp and classify values at configured breaks', () => {
  const classes = validateCogClasses([{ max: 5 }]);
  const ramp = ['#000000', '#ffffff'];
  assert.deepEqual(cogClassRampColors(ramp, classes), ['#000000', '#ffffff']);

  const colors = cogClassColorLut(ramp, classes, 0, 10);
  assert.equal(colors.length, 4096);
  assert.equal(colors[0], '#000000');
  assert.equal(colors[2047], '#000000');
  assert.equal(colors[2048], '#ffffff');
  assert.equal(colors.at(-1), '#ffffff');
});

test('COG class coloring supports a final open-ended class', () => {
  const classes = validateCogClasses([{ max: 10 }, { max: 20 }]);
  assert.deepEqual(cogClassRampColors(['#ff0000', '#0000ff'], classes), [
    '#ff0000',
    '#800080',
    '#0000ff'
  ]);
  const colors = cogClassColorLut(['#ff0000', '#0000ff'], classes, 0, 30);
  assert.equal(colors.at(-1), '#0000ff');
});
