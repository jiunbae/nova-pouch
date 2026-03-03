import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();

const errors = [];
page.on('console', msg => {
  if (msg.type() === 'error') errors.push(msg.text());
  if (msg.type() === 'warn') console.log(`  [warn] ${msg.text()}`);
});
page.on('pageerror', err => { errors.push(err.message); console.log(`  [PAGE ERROR] ${err.message}`); });

await page.goto('http://localhost:3456');
console.log('1. Page loaded');

const idleVisible = await page.$eval('#layer-idle', el => el.classList.contains('layer--active'));
console.log(`2. Idle layer active: ${idleVisible}`);

// Click start
await page.click('#btn-start', { force: true });
await page.waitForTimeout(500);

const gameVisible = await page.$eval('#layer-game', el => el.classList.contains('layer--active'));
console.log(`3. Game layer active: ${gameVisible}`);

// Check red step is active
const redStepActive = await page.$eval('#step-draw-red', el => el.classList.contains('step--active'));
console.log(`4. Red draw step active: ${redStepActive}`);

// Draw red token
await page.click('#step-pouch-red', { force: true });
await page.waitForTimeout(2500);

const redTokenRevealed = await page.$eval('#step-token-red', el => el.children.length > 0);
console.log(`5. Red token revealed: ${redTokenRevealed}`);

if (redTokenRevealed) {
  // Confirm red token
  await page.click('[data-action="confirm-pouch"][data-pouch="red"]', { force: true });
  await page.waitForTimeout(500);

  const blueStepActive = await page.$eval('#step-draw-blue', el => el.classList.contains('step--active'));
  console.log(`6. After red confirm → blue step active: ${blueStepActive}`);

  // Draw blue token
  await page.click('#step-pouch-blue', { force: true });
  await page.waitForTimeout(2500);
  await page.click('[data-action="confirm-pouch"][data-pouch="blue"]', { force: true });
  await page.waitForTimeout(500);

  const greenStepActive = await page.$eval('#step-draw-green', el => el.classList.contains('step--active'));
  console.log(`7. After blue confirm → green step active: ${greenStepActive}`);

  // Draw green token
  await page.click('#step-pouch-green', { force: true });
  await page.waitForTimeout(2500);
  await page.click('[data-action="confirm-pouch"][data-pouch="green"]', { force: true });
  await page.waitForTimeout(500);

  // Check review step is active
  const reviewStepActive = await page.$eval('#step-review', el => el.classList.contains('step--active'));
  console.log(`8. Review step active: ${reviewStepActive}`);

  if (reviewStepActive) {
    const combo = await page.$eval('#review-combo-text', el => el.textContent);
    console.log(`9. Combo: ${combo}`);

    // Go to writing (click sr-only button via evaluate for reliability)
    await page.$eval('#step-btn-write', btn => btn.click());
    await page.waitForTimeout(1500);
    const writingStepActive = await page.$eval('#step-writing', el => el.classList.contains('step--active'));
    console.log(`10. Writing step active: ${writingStepActive}`);
  }
} else {
  console.log('FAIL: Red token was not drawn.');
}

if (errors.length) {
  console.log('\nJS Errors:');
  errors.forEach(e => console.log(`  - ${e}`));
}

await browser.close();
console.log('\nDone!');
