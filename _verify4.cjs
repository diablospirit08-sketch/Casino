const { chromium } = require('C:/Users/odado/AppData/Local/npm-cache/_npx/48b1ca104c3549f4/node_modules/playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();

  page.on('console', m => {
    if (m.type() === 'error') console.log('CONSOLE ERR:', m.text());
  });
  page.on('pageerror', e => {
    console.log('PAGE ERR:', e.message);
    console.log('STACK:', e.stack?.split('\n').slice(0,5).join('\n'));
  });

  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('file:///E:/Projects/casino/Volt%20Casino.html', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(3000);

  // Check which elements are null
  const nullCheck = await page.evaluate(() => {
    const ids = ['railNav','railToggle','betBody','provRow','chatBtn','notifBtn','walletMenu','walletBal'];
    return ids.map(id => ({ id, found: !!document.getElementById(id) }));
  });
  console.log('\nElement null check:');
  nullCheck.forEach(({id, found}) => console.log(` ${found ? '✓' : '✗ NULL'} #${id}`));

  await browser.close();
})();
