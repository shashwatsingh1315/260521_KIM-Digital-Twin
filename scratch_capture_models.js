// scratch_capture_models.js
// Run with: node scratch_capture_models.js
// Requires the dev server to be running at http://localhost:5173

import { chromium } from 'playwright';
import { mkdir } from 'fs/promises';
import path from 'path';

const SCRATCH_DIR = '/home/shashwatsingh/.gemini/antigravity-cli/brain/e65ed2e0-5463-450d-b15d-0e5d773a26b6/scratch';

const MODELS = [
  'DockMesh',
  'BufferMesh',
  'InspectionMesh',
  'StoreMesh',
  'SMTMesh',
  'FCTMesh',
  'TRSSMesh',
  'Assembly1PMesh',
  'SFGPackMesh',
  'VCMesh',
  'PackMesh',
  'ASRSMesh',
  'ASRSPointMesh',
  'LiftMesh',
  'RampMesh',
  'DispatchMesh',
  'ExternalMesh',
];

(async () => {
  await mkdir(SCRATCH_DIR, { recursive: true });
  
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  
  for (const modelId of MODELS) {
    console.log(`Capturing ${modelId}...`);
    const page = await context.newPage();
    
    page.on('console', msg => console.log('BROWSER CONSOLE:', msg.text()));
    page.on('pageerror', err => console.log('BROWSER ERROR:', err.message));

    await page.goto(`http://localhost:5173/?inspector=true&model=${modelId}`, {
      waitUntil: 'networkidle',
    });
    
    // Wait for the canvas to appear and render (3D takes a moment)
    await page.waitForSelector('canvas', { timeout: 10000 });
    await page.waitForTimeout(2000); // Give the 3D scene time to settle
    
    const screenshotPath = path.join(SCRATCH_DIR, `model_${modelId}.png`);
    await page.screenshot({
      path: screenshotPath,
      fullPage: false,
    });
    
    console.log(`  ✓ Saved to ${screenshotPath}`);
    await page.close();
  }
  
  await browser.close();
  console.log('\n✅ All 17 model screenshots captured!');
})();