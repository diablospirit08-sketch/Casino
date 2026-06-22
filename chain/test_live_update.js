const { chromium } = require('./node_modules/playwright');
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext();
  
  // Open casino page first
  const casino = await ctx.newPage();
  await casino.goto('file:///e:/Projects/casino/Volt%20Casino.html');
  await casino.waitForTimeout(600);
  
  const before = await casino.evaluate(() => document.getElementById('promoPairImgA').src);
  console.log('Before (default):', before.split('/').pop());
  
  // Open admin page in second tab, save to volt-promo-pair
  const admin = await ctx.newPage();
  await admin.goto('file:///e:/Projects/casino/Volt%20Casino.html'); // use casino as proxy to write LS
  await admin.evaluate(() => {
    localStorage.setItem('volt-promo-pair', JSON.stringify({
      a: { img: 'art/art-slots-sin-city.webp', head: 'LIVE UPDATE', sub: 's', btn: 'b' }
    }));
  });
  
  // Wait for storage event to fire in casino tab
  await casino.waitForTimeout(600);
  
  const after = await casino.evaluate(() => ({
    src: document.getElementById('promoPairImgA').src.split('/').pop(),
    head: document.getElementById('promoPairHeadA').textContent
  }));
  console.log('After (auto-updated):', after);
  
  // Cleanup
  await admin.evaluate(() => localStorage.removeItem('volt-promo-pair'));
  await b.close();
})().catch(e => console.error('ERROR:', e.message));
