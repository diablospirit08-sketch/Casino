const { chromium } = require('C:/Users/odado/AppData/Local/npm-cache/_npx/48b1ca104c3549f4/node_modules/playwright');
const fs = require('fs');
const outDir = 'e:/Projects/casino/_verify_shots';
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir);

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('file:///E:/Projects/casino/Volt%20Casino.html', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);

  // Full page screenshot
  await page.screenshot({ path: outDir + '/r01_full.png', fullPage: false });

  // Hero / carousel
  const hero = await page.$('.hcar');
  if (hero) await hero.screenshot({ path: outDir + '/r02_hero.png' });

  // Category filter bar
  const cats = await page.$('.cats');
  if (cats) await cats.screenshot({ path: outDir + '/r03_cats.png' });

  // Originals row
  const origRow = await page.$('.row');
  if (origRow) await origRow.screenshot({ path: outDir + '/r04_originals_row.png' });

  // Scroll down to show more content
  await page.evaluate(() => window.scrollBy(0, 900));
  await page.waitForTimeout(400);
  await page.screenshot({ path: outDir + '/r05_mid.png' });

  // Scroll to footer
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(400);
  await page.screenshot({ path: outDir + '/r06_footer.png' });

  // VIP section
  await page.evaluate(() => {
    const el = document.querySelector('.vip-sec-head');
    if (el) el.scrollIntoView({ block: 'center' });
  });
  await page.waitForTimeout(400);
  await page.screenshot({ path: outDir + '/r07_vip.png' });

  // All Bets table
  await page.evaluate(() => {
    const el = document.querySelector('.bt');
    if (el) el.scrollIntoView({ block: 'center' });
  });
  await page.waitForTimeout(400);
  await page.screenshot({ path: outDir + '/r08_bets_table.png' });

  // Rail close-up
  const rail = await page.$('.rail');
  if (rail) await rail.screenshot({ path: outDir + '/r09_rail.png' });

  // Header
  const hdr = await page.$('header');
  if (hdr) await hdr.screenshot({ path: outDir + '/r10_header.png' });

  await browser.close();
  console.log('done');
})();
