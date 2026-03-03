
import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  
  // Go to the app
  await page.goto('http://localhost:5173');
  
  // Wait for idle layer
  await page.waitForSelector('#layer-idle.layer--active');
  
  console.log('--- Clicking Start ---');
  await page.click('#btn-start');
  
  // We want to capture the position of the pouch as soon as it becomes visible
  // but before it might "jump"
  
  const positions = [];
  const capture = async () => {
    const pouch = await page.$('#step-pouch-red');
    if (pouch) {
      const box = await pouch.boundingBox();
      if (box) {
        positions.push({ time: Date.now(), y: box.y });
      }
    }
  };

  // Poll for 1 second
  const start = Date.now();
  while (Date.now() - start < 1000) {
    await capture();
    await page.waitForTimeout(16); // ~1 frame
  }
  
  console.log('Pouch Y positions over time:');
  positions.forEach((p, i) => {
    if (i === 0 || p.y !== positions[i-1].y) {
      console.log(`T+${p.time - start}ms: Y=${p.y}`);
    }
  });

  await browser.close();
})();
