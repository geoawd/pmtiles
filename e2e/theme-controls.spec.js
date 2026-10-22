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

test('advanced mode shows Terra Draw controls below Find My Location', async ({ page }) => {
  await page.getByRole('button', { name: 'Advanced mode' }).click();
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

test('advanced mode keeps drawing controls hidden on mobile', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: 'Advanced mode' }).click();
  await expect(page.getByRole('button', { name: 'Point', exact: true })).toBeHidden();
  await expect(page.getByRole('button', { name: 'Polygon', exact: true })).toBeHidden();
  await expect(page.getByRole('button', { name: 'Download', exact: true })).toBeHidden();
});

test('standard mode hides drawing and advanced COG controls until enabled', async ({ page }) => {
  const advancedMode = page.getByRole('button', { name: 'Advanced mode' });
  const pointButton = page.getByRole('button', { name: 'Point', exact: true });
  const boxButton = page.getByRole('button', { name: 'Select by box' });
  await expect(advancedMode).toHaveAttribute('aria-pressed', 'false');
  await expect(pointButton).toBeHidden();
  await expect(boxButton).toBeVisible();
  await boxButton.click();
  await expect(page.locator('body')).toHaveClass(/box-on/);
  await advancedMode.click();
  await expect(advancedMode).toHaveAttribute('aria-pressed', 'true');
  await expect(boxButton).toBeVisible();
  await expect(pointButton).toBeVisible();
  await advancedMode.click();
  await expect(page.locator('body')).not.toHaveClass(/box-on/);
  await expect(pointButton).toBeHidden();

  await page.evaluate(() => {
    window.MaplibreCOGProtocol.getCogMetadata = async () => ({
      bitsPerSample: [16],
      bbox: [-8, 54, -7, 55],
      images: [{ isMask: false, zoom: 0 }]
    });
    window.MaplibreCOGProtocol.locationValues = async (_url, point) => [point.longitude];
  });
  await page.getByRole('combobox', { name: 'Theme' }).selectOption({ label: 'Tellus Geochemistry' });
  const aluminium = page.getByRole('checkbox', { name: /^Aluminium Al %/ });
  const row = aluminium.locator('xpath=ancestor::*[@data-order-key][1]');
  await row.locator('.tbtn[aria-label^="Transparency"]').click();
  await expect(row.locator('.cog-source-copy')).toBeVisible();
  const rampLegend = row.locator('.cog-ramp-legend');
  await expect(rampLegend).toBeVisible();
  await expect(rampLegend.locator('.cog-ramp-legend-title')).toContainText('%');
  await expect(rampLegend.locator('.cog-ramp-legend-bar, .cog-ramp-class-legend')).toBeVisible();
  await expect(rampLegend.locator('.cog-ramp-legend-ramp-name')).toBeHidden();
  await expect(row.locator('.cog-ramp-picker-button')).toBeHidden();
  await expect(row.locator('.cog-ramp-mode-select')).toBeHidden();
  await expect(row.locator('.cog-hillshade-toggle')).toBeHidden();
  await advancedMode.click();
  await expect(rampLegend.locator('.cog-ramp-legend-ramp-name')).toBeVisible();
  await expect(row.locator('.cog-ramp-picker-button')).toBeVisible();
  await expect(row.locator('.cog-ramp-mode-select')).toBeVisible();
});

test('add-data search only shows matching layers inside matching groups', async ({ page }) => {
  await page.getByRole('combobox', { name: 'Theme' }).selectOption({ label: 'Site Investigations' });
  await page.getByRole('button', { name: 'Add data to the current theme' }).click();
  const search = page.getByRole('searchbox', { name: 'Search groups and layers' });
  const magneticsGroup = page.locator('#addDataList fieldset[data-group-name="Tellus Magnetics"]');
  await search.fill('Tellus Magnetics');
  await expect(magneticsGroup).toBeVisible();
  await expect(magneticsGroup.locator('.add-data-items > label:visible')).toHaveCount(0);

  await search.fill('Magnetics RTP');
  await expect(magneticsGroup.locator('.add-data-items > label:visible')).toHaveText([
    'Magnetics RTP',
    'Magnetics RTP Tilt Derivative'
  ]);
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

test('overlay groups default to one layer and preserve visibility per theme', async ({ page }) => {
  await page.evaluate(() => {
    window.MaplibreCOGProtocol.getCogMetadata = async () => ({ bitsPerSample: [16, 16, 16] });
  });
  const theme = page.getByRole('combobox', { name: 'Theme' });
  const groupLayers = name => page.locator(
    `#legend .lgroup[data-group-name="${name}"] .lgbody .grprow input[type="checkbox"]`
  );
  await theme.selectOption({ label: 'Tellus Geophysics' });

  const magnetics = groupLayers('Tellus Magnetics');
  const electromagnetics = groupLayers('Tellus Electromagnetics');
  const radiometrics = groupLayers('Tellus Radiometrics');
  await expect(magnetics.first()).toBeChecked();
  expect(await electromagnetics.evaluateAll(inputs => inputs.map(input => input.checked))).toEqual(
    new Array(await electromagnetics.count()).fill(false)
  );
  expect(await radiometrics.evaluateAll(inputs => inputs.map(input => input.checked))).toEqual(
    new Array(await radiometrics.count()).fill(false)
  );
  await magnetics.first().uncheck();
  await magnetics.nth(1).check();

  await theme.selectOption({ label: 'Tellus Geochemistry' });
  const geochemistry = groupLayers('Tellus Soils A Aqua Regia');
  await expect(geochemistry.first()).toBeChecked();
  await geochemistry.first().uncheck();
  await geochemistry.nth(1).check();

  await theme.selectOption({ label: 'Tellus Geophysics' });
  await expect(magnetics.first()).not.toBeChecked();
  await expect(magnetics.nth(1)).toBeChecked();
  expect(await electromagnetics.evaluateAll(inputs => inputs.map(input => input.checked))).toEqual(
    new Array(await electromagnetics.count()).fill(false)
  );
  expect(await radiometrics.evaluateAll(inputs => inputs.map(input => input.checked))).toEqual(
    new Array(await radiometrics.count()).fill(false)
  );

  await theme.selectOption({ label: 'Tellus Geochemistry' });
  await expect(geochemistry.first()).not.toBeChecked();
  await expect(geochemistry.nth(1)).toBeChecked();
});
