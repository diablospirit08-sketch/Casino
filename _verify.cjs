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

  // Full viewport
  await page.screenshot({ path: outDir + '/01_full.png' });

  // Header
  const hdr = await page.$('header');
  if (hdr) await hdr.screenshot({ path: outDir + '/02_header.png' });

  // Rail nav
  const rail = await page.$('.rail');
  if (rail) await rail.screenshot({ path: outDir + '/03_rail.png' });

  // First game row
  const row = await page.$('.row');
  if (row) await row.screenshot({ path: outDir + '/04_game_cards.png' });

  // Footer
  const footer = await page.$('footer');
  if (footer) await footer.screenshot({ path: outDir + '/05_footer.png' });

  // VIP section
  await page.evaluate(() => {
    const el = document.querySelector('.vip-sec-head');
    if (el) el.scrollIntoView({ block: 'start' });
  });
  await page.waitForTimeout(400);
  await page.screenshot({ path: outDir + '/06_vip_section.png' });

  // Category filter bar
  const cats = await page.$('.cats');
  if (cats) await cats.screenshot({ path: outDir + '/07_cats.png' });

  await browser.close();
  console.log('done');
})();
