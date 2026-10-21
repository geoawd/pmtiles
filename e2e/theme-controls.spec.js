import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.route('https://tile.openstreetmap.org/**', route => route.abort());
  await page.goto('/');
  await expect(page.locator('#themeSel option').first()).toBeAttached({ timeout: 20_000 });
  await expect(page.getByRole('combobox', { name: 'Theme' })).toBeVisible();
  await page.evaluate(() => {
    const prototype = window.maplibregl.Map.prototype;
    const setLayoutProperty = prototype.setLayoutProperty;
    window.__visibilityCalls = [];
    prototype.setLayoutProperty = function (...args) {
      if (args[1] === 'visibility') {
        window.__visibilityCalls.push({ layerId: args[0], visibility: args[2] });
      }
      return setLayoutProperty.apply(this, args);
    };
  });
});

test('Terra Draw controls are expanded below Find My Location', async ({ page }) => {
  const pointButton = page.getByRole('button', { name: 'Point', exact: true });
  const polygonButton = page.getByRole('button', { name: 'Polygon', exact: true });
  const downloadButton = page.getByRole('button', { name: 'Download', exact: true });
  await expect(pointButton).toBeVisible();
  await expect(polygonButton).toBeVisible();
  await expect(downloadButton).toBeVisible();

  const drawControlFollowsGeolocate = await page.locator('.maplibregl-ctrl-top-right').evaluate(container => {
    const locationControl = container.querySelector('.maplibregl-ctrl-geolocate')?.closest('.maplibregl-ctrl');
    const pointControl = [...container.querySelectorAll('button')]
      .find(button => (button.getAttribute('aria-label') || button.title) === 'Point')
      ?.closest('.maplibregl-ctrl');
    return !!locationControl && !!pointControl &&
      [...container.children].indexOf(pointControl) === [...container.children].indexOf(locationControl) + 1;
  });
  expect(drawControlFollowsGeolocate).toBe(true);
});

test('saved-session prompt offers only Resume and Reset app', async ({ page }) => {
  await page.evaluate(() => {
    localStorage.setItem('mapviewer.session.v1', JSON.stringify({
      version: 1,
      view: { center: [-6, 54], zoom: 8 }
    }));
  });
  await page.reload();

  const dialog = page.getByRole('dialog', { name: 'Resume your previous session?' });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('button')).toHaveText(['Resume', 'Reset app']);
  await expect(dialog.getByRole('button', { name: /Start Over/ })).toHaveCount(0);
});

test('Site Investigations exposes its vector layers and updates their map visibility', async ({ page }) => {
  await page.getByRole('combobox', { name: 'Theme' }).selectOption({ label: 'Site Investigations' });

  const siteReports = page.getByRole('checkbox', { name: 'Site Reports', exact: true });
  const boreholes = page.getByRole('checkbox', { name: 'Boreholes', exact: true });
  await expect(siteReports).toBeVisible();
  await expect(boreholes).toBeVisible();
  await expect(page.getByRole('heading', { name: /Geotechnical/ })).toBeVisible();

  await page.evaluate(() => { window.__visibilityCalls.length = 0; });
  await siteReports.check();
  await expect(siteReports).toBeChecked();
  await expect.poll(() => page.evaluate(() =>
    window.__visibilityCalls.some(call =>
      call.layerId.startsWith('Site_Reports') && call.visibility === 'visible'
    )
  )).toBe(true);

  await siteReports.uncheck();
  await expect(siteReports).not.toBeChecked();
  await expect.poll(() => page.evaluate(() =>
    window.__visibilityCalls.some(call =>
      call.layerId.startsWith('Site_Reports') && call.visibility === 'none'
    )
  )).toBe(true);
});

test('Tellus Geophysics exposes its raster groups and toggles a COG layer', async ({ page }) => {
  await page.getByRole('combobox', { name: 'Theme' }).selectOption({ label: 'Tellus Geophysics' });

  const legend = page.locator('#legend');
  await expect(legend).toContainText('Tellus Magnetics');
  await expect(legend).toContainText('Tellus Electromagnetics');
  await expect(legend).toContainText('Tellus Radiometrics');

  const magnetics = page.getByRole('checkbox', { name: 'Magnetics Residual', exact: true });
  await expect(magnetics).toBeVisible();
  const wasChecked = await magnetics.isChecked();
  const expectedVisibility = wasChecked ? 'none' : 'visible';
  await page.evaluate(() => { window.__visibilityCalls.length = 0; });
  if (wasChecked) await magnetics.uncheck();
  else await magnetics.check();
  await expect(magnetics).toHaveJSProperty('checked', !wasChecked);
  await expect.poll(() => page.evaluate(visibility =>
    window.__visibilityCalls.some(call =>
      call.layerId === 'Magnetics Residual' && call.visibility === visibility
    ), expectedVisibility
  )).toBe(true);
});

test('Tellus Geochemistry samples only the COG layer that is enabled', async ({ page }) => {
  await page.route('https://data.better-open-data.com/**', route => route.abort());
  await page.evaluate(() => {
    const protocol = window.MaplibreCOGProtocol;
    window.__cogMetadataCalls = [];
    window.__cogRangeCalls = [];
    protocol.getCogMetadata = async url => {
      window.__cogMetadataCalls.push(url);
      return { bitsPerSample: [16], bbox: [-8, 54, -7, 55], images: [{ isMask: false, zoom: 0 }] };
    };
    protocol.locationValues = async url => {
      window.__cogRangeCalls.push(url);
      throw new Error('Stop after observing the first range batch');
    };
  });
  await page.getByRole('combobox', { name: 'Theme' }).selectOption({ label: 'Tellus Geochemistry' });
  const aluminium = page.getByRole('checkbox', { name: /^Aluminium Al %/ });
  const antimony = page.getByRole('checkbox', { name: /^Antimony Sb mg\/kg/ });
  await expect(aluminium).toBeVisible();
  await expect(aluminium).toBeChecked();
  await expect(antimony).not.toBeChecked();
  await expect.poll(() => page.evaluate(() => window.__cogMetadataCalls.length)).toBe(1);
  await expect.poll(() => page.evaluate(() => window.__cogRangeCalls.length)).toBe(32);
  expect(await page.evaluate(() => window.__cogMetadataCalls[0])).toContain('/Aluminium');
  expect(await page.evaluate(() => [...new Set(window.__cogRangeCalls)])).toHaveLength(1);

  await aluminium.uncheck();
  await antimony.check();
  await expect.poll(() => page.evaluate(() => window.__cogMetadataCalls.length)).toBe(2);
  await expect.poll(() => page.evaluate(() => window.__cogRangeCalls.length)).toBe(64);
  const requestedUrls = await page.evaluate(() => [...new Set(window.__cogRangeCalls)]);
  expect(requestedUrls).toHaveLength(2);
  expect(requestedUrls.some(url => url.includes('/Antimony%20Sb'))).toBe(true);
});

test('mobile map readout shows Irish Grid and COG values at the map centre', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.route('https://data.better-open-data.com/**', route => route.abort());
  await page.evaluate(() => {
    const protocol = window.MaplibreCOGProtocol;
    window.__centerReadoutPoints = [];
    protocol.getCogMetadata = async () => ({
      bitsPerSample: [16],
      bbox: [-8, 54, -7, 55],
      images: [{ isMask: false, zoom: 0 }]
    });
    protocol.locationValues = async (url, point, zoom) => {
      if (zoom !== undefined) throw new Error('Skip range sampling in the mobile readout test');
      window.__centerReadoutPoints.push(point);
      return [42.75];
    };
  });
  await page.getByRole('combobox', { name: 'Theme' }).selectOption({ label: 'Tellus Geochemistry' });

  const readout = page.locator('#mobileMapReadout');
  await expect(readout).toBeVisible();
  await expect(readout.locator('strong')).toHaveText('Values at centre of map');
  await expect(page.locator('#mobileCogValues')).toContainText(/Aluminium.*42\.75/);
  const expectedGrid = await page.evaluate(() => {
    const [east, north] = window.proj4('EPSG:4326', 'EPSG:29902', window.CONFIG.center);
    return `Irish Grid  E ${east.toFixed(0)}  N ${north.toFixed(0)}`;
  });
  await expect(page.locator('#mobileMapCoords')).toHaveText(expectedGrid);
  const samplePoint = await page.evaluate(() => window.__centerReadoutPoints.at(-1));
  const [longitude, latitude] = await page.evaluate(() => window.CONFIG.center);
  expect(samplePoint.longitude).toBeCloseTo(longitude, 5);
  expect(samplePoint.latitude).toBeCloseTo(latitude, 5);
});

test('mobile readout starts with legacy MediaQueryList listeners', async ({ page }) => {
  await page.addInitScript(() => {
    const prototype = Object.getPrototypeOf(window.matchMedia('(max-width: 700px)'));
    Object.defineProperty(prototype, 'addEventListener', { configurable: true, value: undefined });
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.reload();
  await expect(page.locator('#mobileMapReadout')).toBeVisible();
});

test('switching between Site Investigations and Tellus Geophysics preserves theme visibility', async ({ page }) => {
  const theme = page.getByRole('combobox', { name: 'Theme' });
  const siteReports = page.getByRole('checkbox', { name: 'Site Reports', exact: true });
  const magnetics = page.getByRole('checkbox', { name: 'Magnetics Residual', exact: true });

  await theme.selectOption({ label: 'Site Investigations' });
  await expect(siteReports).toBeVisible();
  await siteReports.check();
  await expect(siteReports).toBeChecked();

  await page.evaluate(() => { window.__visibilityCalls.length = 0; });
  await theme.selectOption({ label: 'Tellus Geophysics' });
  await expect(siteReports).toBeHidden();
  await expect(magnetics).toBeVisible();
  await expect.poll(() => page.evaluate(() =>
    window.__visibilityCalls.some(call =>
      call.layerId.startsWith('Site_Reports') && call.visibility === 'none'
    )
  )).toBe(true);

  if (await magnetics.isChecked()) await magnetics.uncheck();
  await magnetics.check();
  await expect(magnetics).toBeChecked();

  await page.evaluate(() => { window.__visibilityCalls.length = 0; });
  await theme.selectOption({ label: 'Site Investigations' });
  await expect(siteReports).toBeVisible();
  await expect(siteReports).toBeChecked();
  await expect(magnetics).toBeHidden();
  await expect.poll(() => page.evaluate(() =>
    window.__visibilityCalls.some(call =>
      call.layerId.startsWith('Site_Reports') && call.visibility === 'visible'
    )
  )).toBe(true);
  await expect.poll(() => page.evaluate(() =>
    window.__visibilityCalls.some(call =>
      call.layerId === 'Magnetics Residual' && call.visibility === 'none'
    )
  )).toBe(true);
});
