import { test, expect } from '@playwright/test';

test.describe('Factory Twin E2E', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('should render 3D viewport canvas', async ({ page }) => {
    const canvas = page.locator('canvas');
    await expect(canvas).toBeVisible();
  });

  test('should toggle shock state and update UI', async ({ page }) => {
    const scenarioItem = page.locator('.queue-item', { hasText: 'SMT Line Jam' });
    await expect(scenarioItem).toBeVisible();
    
    // Initially Running
    await expect(page.locator('text=RUNNING')).toBeVisible();
    await expect(scenarioItem.locator('text=OFF')).toBeVisible();
    
    // Click scenario to toggle it
    await scenarioItem.click();
    
    await expect(scenarioItem.locator('text=ACTIVE')).toBeVisible();
    await expect(page.locator('.badge', { hasText: 'BOTTLENECK' })).toBeVisible();
  });

  test('should manipulate timeline', async ({ page }) => {
    const timelineInput = page.locator('.slider');
    await timelineInput.fill('80');
    await expect(page.locator('text=T-20 (Historical)')).toBeVisible();
    
    const resumeBtn = page.getByRole('button', { name: /Resume Live/i });
    await expect(resumeBtn).toBeVisible();
    await resumeBtn.click();
    
    await expect(page.locator('text=LIVE')).toBeVisible();
  });
});
