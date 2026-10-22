import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.route('https://tile.openstreetmap.org/**', route => route.abort());
  await page.goto('/');
  await expect(page.locator('#themeSel option').first()).toBeAttached({ timeout: 20_000 });
});

test('configured map notifications are advanced-only and collect a six-digit grid point', async ({ page }) => {
  const boreholeButton = page.getByRole('button', { name: 'Report a borehole' });
  await expect(boreholeButton).toBeHidden();

  await page.getByRole('button', { name: 'Advanced mode' }).click();
  await expect(boreholeButton).toBeVisible();
  const controlsAboveAttribution = await page.evaluate(() => {
    const controls = document.querySelector('.maplibregl-ctrl-bottom-right');
    const button = controls?.querySelector('.notification-control-group button');
    const attribution = controls?.querySelector('.maplibregl-ctrl-attrib');
    return !!controls && !!button && !!attribution &&
      button.getBoundingClientRect().bottom <= attribution.getBoundingClientRect().top;
  });
  expect(controlsAboveAttribution).toBe(true);
  await boreholeButton.click();
  await expect(boreholeButton).toHaveAttribute('aria-pressed', 'true');
  await page.locator('#map canvas').click({ position: { x: 300, y: 250 } });

  const dialog = page.getByRole('dialog', { name: 'Borehole notification' });
  await expect(dialog).toBeVisible();
  await expect(page.locator('#notificationLocation')).toContainText(/Irish Grid E \d{6} N \d{6}/);
  await expect(page.getByLabel('Borehole name or ID')).toBeVisible();
  await expect(page.getByLabel('Type')).toBeVisible();
  await expect(page.locator('#notificationPreview')).toHaveValue(/Grid reference: Irish Grid E \d{6} N \d{6}/);
  await expect(page.locator('#notificationPreview')).toHaveValue(/WGS84 latitude\/longitude:/);
  const reminder = page.locator('#notificationReminder');
  await expect(reminder).toHaveText('Please attach borehole reports, logs, and photos to your email.');
  await expect(reminder).toHaveCSS('font-weight', '600');
  await expect(page.locator('#notificationPreview'))
    .not.toHaveValue(/Please attach borehole reports, logs, and photos to your email\./);

  await page.evaluate(() => {
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: async text => { window.__copiedNotification = text; } }
    });
  });
  await page.getByRole('button', { name: 'Copy text' }).click();
  await expect.poll(() => page.evaluate(() => window.__copiedNotification))
    .toContain('Grid reference: Irish Grid E');
  await expect.poll(() => page.evaluate(() => window.__copiedNotification))
    .not.toContain('Please attach borehole reports, logs, and photos to your email.');
});

test('keyboard users can select a notification point from the map centre', async ({ page }) => {
  await page.getByRole('button', { name: 'Advanced mode' }).click();
  const button = page.getByRole('button', { name: 'Report a borehole' });
  await button.click();

  const canvas = page.locator('#map canvas');
  await expect(canvas).toBeFocused();
  await expect(page.locator('#toast')).toContainText('press Enter or Space');
  await canvas.press('Enter');

  await expect(page.getByRole('dialog', { name: 'Borehole notification' })).toBeVisible();
  await expect(page.locator('#notificationLocation')).toContainText(/Irish Grid E \d{6} N \d{6}/);
  await expect(button).toHaveAttribute('aria-pressed', 'false');
});

test('notification forms are selected from configuration', async ({ page }) => {
  await page.getByRole('button', { name: 'Advanced mode' }).click();
  await page.getByRole('button', { name: 'Report a landslide' }).click();
  await page.locator('#map canvas').click({ position: { x: 300, y: 250 } });
  await expect(page.getByRole('dialog', { name: 'Landslide notification' })).toBeVisible();
  await expect(page.getByLabel('Date observed')).toBeVisible();
  await expect(page.getByLabel('Description and notes')).toBeVisible();
  await expect(page.locator('#notificationReminder'))
    .toHaveText('Please attach landslide reports and photos to your email.');
  await expect(page.getByLabel('Borehole name or ID')).toHaveCount(0);
});
