const COG_RESAMPLING_METHODS = new Set(['nearest', 'bilinear']);

export function cogResamplingUrl(url, resampling) {
  if (resampling === undefined) return url;
  if (!COG_RESAMPLING_METHODS.has(resampling)) {
    throw new Error('COG resampling must be "nearest" or "bilinear".');
  }
  return `${url}${url.includes('#') ? '&' : '#&'}resampling=${resampling}`;
}
