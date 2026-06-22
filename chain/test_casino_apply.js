const { chromium } = require('./node_modules/playwright');
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext();
  
  // Pre-seed localStorage with test data
  const p1 = await ctx.newPage();
  await p1.goto('file:///e:/Projects/casino/Volt%20Casino.html');
  await p1.evaluate(() => {
    localStorage.setItem('volt-promo-pair', JSON.stringify({
      a: { img: 'art/art-slots-sin-city.webp', head: 'TEST HEADING A', sub: 'test sub a', btn: 'Click A' },
      b: { img: 'art/poster-wiseguys.webp', head: 'TEST HEADING B', sub: 'test sub b', btn: 'Click B' }
    }));
  });
  await p1.close();
  
  // Now open a fresh casino page - IIFE should apply the saved data
  const p2 = await ctx.newPage();
  await p2.goto('file:///e:/Projects/casino/Volt%20Casino.html');
  await p2.waitForTimeout(600);
  
  const result = await p2.evaluate(() => ({
    imgA: document.getElementById('promoPairImgA')?.src,
    headA: document.getElementById('promoPairHeadA')?.textContent,
    imgB: document.getElementById('promoPairImgB')?.src,
    headB: document.getElementById('promoPairHeadB')?.textContent,
    lsValue: localStorage.getItem('volt-promo-pair')
  }));
  
  console.log(JSON.stringify(result, null, 2));
  
  // Cleanup
  await p2.evaluate(() => localStorage.removeItem('volt-promo-pair'));
  await b.close();
})().catch(e => console.error('ERROR:', e.message));
