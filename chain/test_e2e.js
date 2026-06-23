const { chromium } = require('./node_modules/playwright');
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext();

  // Casino page open first (user already has it open)
  const casino = await ctx.newPage();
  await casino.goto('file:///e:/Projects/casino/Volt%20Casino.html');
  await casino.waitForTimeout(600);

  const defaultImg = await casino.evaluate(() => document.getElementById('promoPairImgA').src);
  console.log('Default img:', defaultImg.split('/').pop());

  // Admin page "saves" (simulate savePromoPair writing to localStorage)
  const admin = await ctx.newPage();
  await admin.goto('file:///e:/Projects/casino/admin.html');
  await admin.evaluate(() => {
    // Directly write to localStorage as savePromoPair would
    localStorage.setItem('volt-promo-pair', JSON.stringify({
      a: { img: 'art/art-slots-sin-city.webp', head: 'CHANGED!', sub: 'new sub', btn: 'New Btn' }
    }));
  });
  await admin.close();

  // Storage event fires in casino tab — wait for it
  await casino.waitForTimeout(500);

  const liveImg = await casino.evaluate(() => ({
    src: document.getElementById('promoPairImgA').src.split('/').pop(),
    head: document.getElementById('promoPairHeadA').textContent,
    ls: localStorage.getItem('volt-promo-pair')
  }));
  console.log('After admin save (no reload):', liveImg);

  // Take screenshot
  await casino.screenshot({ path: 'e:/Projects/casino/_verify_shots/e2e_live.png' });

  await casino.evaluate(() => localStorage.removeItem('volt-promo-pair'));
  await b.close();
})().catch(e => console.error('ERROR:', e.message));
