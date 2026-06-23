const { chromium } = require('./node_modules/playwright');
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext();

  const casino = await ctx.newPage();
  await casino.goto('file:///e:/Projects/casino/Volt%20Casino.html');
  await casino.waitForTimeout(600);

  console.log('Before:', (await casino.evaluate(() => document.getElementById('promoPairHeadA').textContent)));

  // Simulate admin broadcasting (without localStorage)
  const admin = await ctx.newPage();
  await admin.goto('file:///e:/Projects/casino/admin.html');
  await admin.evaluate(() => {
    new BroadcastChannel('volt-promo').postMessage({
      a: { img: 'art/art-slots-sin-city.webp', head: 'BROADCAST WORKS', sub: 'live', btn: 'Go' }
    });
  });
  await casino.waitForTimeout(400);

  const after = await casino.evaluate(() => ({
    head: document.getElementById('promoPairHeadA').textContent,
    src: document.getElementById('promoPairImgA').src.split('/').pop()
  }));
  console.log('After broadcast:', after);

  await b.close();
})().catch(e => console.error('ERROR:', e.message));
