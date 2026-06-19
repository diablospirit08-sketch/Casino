const { chromium } = require('C:/Users/odado/AppData/Local/npm-cache/_npx/48b1ca104c3549f4/node_modules/playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();

  const errors = [];
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', e => errors.push(e.message));

  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('file:///E:/Projects/casino/Volt%20Casino.html', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(3000);

  const rowCount = await page.evaluate(() => document.getElementById('betBody')?.children.length ?? -1);
  console.log('betBody rows:', rowCount);

  const betBodyHtml = await page.evaluate(() => document.getElementById('betBody')?.innerHTML.slice(0, 300));
  console.log('betBody html:', betBodyHtml);

  if (errors.length) {
    console.log('\nJS ERRORS:');
    errors.forEach(e => console.log(' -', e));
  } else {
    console.log('No JS errors');
  }

  await browser.close();
})();
