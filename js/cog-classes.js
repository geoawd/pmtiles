const COG_CLASS_COLOR_STOP_COUNT = 4096;

export function validateCogClasses(classes) {
  if (!Array.isArray(classes) || classes.length < 1) {
    throw new Error('COG classes must be an array with at least one class break.');
  }

  let previousMax = -Infinity;
  return classes.map((item, index) => {
    if (!item || typeof item !== 'object' || !Number.isFinite(item.max) || item.max <= previousMax) {
      throw new Error(`COG class ${index + 1} must have a finite max greater than the previous class max.`);
    }
    if (item.label !== undefined && (typeof item.label !== 'string' || !item.label.trim())) {
      throw new Error(`COG class ${index + 1} label must be a non-empty string when provided.`);
    }
    previousMax = item.max;
    return { max: item.max, ...(item.label === undefined ? {} : { label: item.label.trim() }) };
  });
}

function rampColorAt(colors, fraction) {
  const colorPosition = fraction * (colors.length - 1);
  const colorIndex = Math.min(Math.floor(colorPosition), colors.length - 2);
  const blend = colorPosition - colorIndex;
  const start = colors[colorIndex].slice(1).match(/.{2}/g).map(value => parseInt(value, 16));
  const end = colors[colorIndex + 1].slice(1).match(/.{2}/g).map(value => parseInt(value, 16));
  return `#${start.map((value, index) =>
    Math.round(value + (end[index] - value) * blend).toString(16).padStart(2, '0')).join('')}`;
}

function classIndex(value, classes) {
  let low = 0;
  let high = classes.length;
  while (low < high) {
    const middle = Math.floor((low + high) / 2);
    if (value <= classes[middle].max) high = middle;
    else low = middle + 1;
  }
  return low;
}

export function cogClassRampColors(rampColors, classes) {
  const classCount = classes.length + 1;
  return Array.from({ length: classCount }, (_, index) =>
    rampColorAt(rampColors, index / (classCount - 1)));
}

export function cogClassColorLut(rampColors, classes, min, max) {
  if (!Number.isFinite(min) || !Number.isFinite(max) || min >= max) {
    throw new Error('COG class coloring requires a varying finite raster value range.');
  }
  const classColors = cogClassRampColors(rampColors, classes);
  return Array.from({ length: COG_CLASS_COLOR_STOP_COUNT }, (_, index) => {
    const value = min + (index + 0.5) * (max - min) / COG_CLASS_COLOR_STOP_COUNT;
    return classColors[classIndex(value, classes)];
  });
}
