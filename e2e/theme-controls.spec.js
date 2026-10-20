import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.route('https://tile.openstreetmap.org/**', route => route.abort());
  await page.goto('/');
  await expect(page.locator('#themeSel option')).toHaveCount(6, { timeout: 20_000 });
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
