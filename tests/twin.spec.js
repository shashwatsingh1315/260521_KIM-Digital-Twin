import { test, expect } from '@playwright/test';

test.describe('Twin UI — golden path', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/twin');
    await page.waitForSelector('[data-testid="twin-canvas"]');
  });

  test('canvas renders', async ({ page }) => {
    await expect(page.locator('[data-testid="twin-app"]')).toBeVisible();
    await expect(page.locator('canvas')).toBeVisible();
  });

  test('sim-time advances', async ({ page }) => {
    const t0 = await page.locator('[data-testid="sim-time"]').textContent();
    await page.waitForTimeout(1500);
    const t1 = await page.locator('[data-testid="sim-time"]').textContent();
    expect(t1).not.toBe(t0);
  });

  test('speed ×100 completes order and done-badge appears', async ({ page }) => {
    await page.click('[data-testid="speed-100"]');
    // done-badge appears once the linearLine order completes (3 units × bottleneck 60s)
    await page.waitForSelector('[data-testid="done-badge"]', { timeout: 15000 });
    await expect(page.locator('[data-testid="done-badge"]')).toBeVisible();
  });

  test('zero shocks on linearLine run', async ({ page }) => {
    await page.click('[data-testid="speed-100"]');
    await page.waitForSelector('[data-testid="done-badge"]', { timeout: 15000 });
    const count = await page.locator('[data-testid="shock-count"]').textContent();
    expect(count.trim()).toBe('0');
  });

  test('pause-and-apply takt: sim pauses on Edit click, resumes after Apply', async ({ page }) => {
    // Click station B to open inspector
    // (station-B renders as an HTML overlay `data-testid="station-station_b"` via drei <Html>)
    await page.click('[data-testid="station-station_b"]');
    await page.waitForSelector('[data-testid="process-form"]');
    // Click Edit — twin pauses
    await page.click('[data-testid="edit-btn"]');
    await expect(page.locator('[data-testid="paused-banner"]')).toBeVisible();
    const t0 = await page.locator('[data-testid="sim-time"]').textContent();
    await page.waitForTimeout(600);
    const t1 = await page.locator('[data-testid="sim-time"]').textContent();
    expect(t1).toBe(t0);   // frozen while editing
    // Apply
    await page.fill('[data-testid="takt-input"]', '30');
    await page.click('[data-testid="apply-btn"]');
    await expect(page.locator('[data-testid="paused-banner"]')).not.toBeVisible();
    await page.waitForTimeout(1000);
    const t2 = await page.locator('[data-testid="sim-time"]').textContent();
    expect(t2).not.toBe(t1);   // running again
  });
});

test.describe('Twin UI — config editors (Part E)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/twin');
    await page.waitForSelector('[data-testid="twin-canvas"]');
  });

  test('schema-impact matrix shows CRUD rows on station click', async ({ page }) => {
    await page.click('[data-testid="station-station_b"]');
    await page.waitForSelector('[data-testid="process-form"]');
    await page.click('[data-testid="schema-toggle-btn"]');
    await page.waitForSelector('[data-testid="schema-matrix-panel"]');
    // Station B (treat) documents an MES row creating Treat_Batch.
    await expect(page.locator('[data-testid="schema-row-MES"]')).toContainText('Treat_Batch');
    await expect(page.locator('[data-testid="schema-row-WMS"]')).toContainText('Location');
  });

  test('track editor applies a valid segment change', async ({ page }) => {
    await page.click('[data-testid="open-track-editor"]');
    await page.waitForSelector('[data-testid="track-editor"]');
    await page.click('[data-testid="track-edit-btn"]');
    await expect(page.locator('[data-testid="track-paused-banner"]')).toBeVisible();
    await page.fill('[data-testid="seg-capacity-s_a_b"]', '7');
    await page.click('[data-testid="track-apply-btn"]');
    // Valid change → edit mode exits (banner gone), no validation errors.
    await expect(page.locator('[data-testid="track-paused-banner"]')).not.toBeVisible();
  });

  test('track editor blocks an invalid segment change', async ({ page }) => {
    await page.click('[data-testid="open-track-editor"]');
    await page.waitForSelector('[data-testid="track-editor"]');
    await page.click('[data-testid="track-edit-btn"]');
    await page.fill('[data-testid="seg-length-s_a_b"]', '0'); // length must be > 0
    await expect(page.locator('[data-testid="track-errors"]')).toBeVisible();
    await expect(page.locator('[data-testid="track-apply-btn"]')).toBeDisabled();
  });

  test('carrier pool panel edits a pool on the carrier scenario', async ({ page }) => {
    await page.click('[data-testid="fixture-carrierLine"]');
    await page.waitForTimeout(700); // engine re-init
    await page.click('[data-testid="open-carrier-panel"]');
    await page.waitForSelector('[data-testid="pool-row-amr1"]');
    await page.click('[data-testid="carrier-edit-btn"]');
    await expect(page.locator('[data-testid="carrier-paused-banner"]')).toBeVisible();
    await page.fill('[data-testid="pool-count-amr1"]', '5');
    await page.click('[data-testid="carrier-apply-btn"]');
    await expect(page.locator('[data-testid="carrier-paused-banner"]')).not.toBeVisible();
  });

  test('fixture selector switches scenario and sim keeps running', async ({ page }) => {
    await page.click('[data-testid="fixture-assemblyLine"]');
    await page.waitForTimeout(700);
    const t0 = await page.locator('[data-testid="sim-time"]').textContent();
    await page.waitForTimeout(1500);
    const t1 = await page.locator('[data-testid="sim-time"]').textContent();
    expect(t1).not.toBe(t0);
  });
});
