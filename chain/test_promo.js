const { chromium } = require('./node_modules/playwright');
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext();
  const adminPage = await ctx.newPage();
  
  await adminPage.goto('file:///e:/Projects/casino/admin.html');
  await adminPage.waitForTimeout(800);
  
  await adminPage.evaluate(() => {
    const items = document.querySelectorAll('.sb-item');
    for (const it of items) {
      if (it.textContent.toLowerCase().includes('promo')) { it.click(); break; }
    }
  });
  await adminPage.waitForTimeout(400);
  
  const urlAExists = await adminPage.evaluate(() => !!document.getElementById('urlA'));
  console.log('urlA exists:', urlAExists);
  const fnType = await adminPage.evaluate(() => typeof window.savePromoPair);
  console.log('savePromoPair type:', fnType);
  
  await adminPage.evaluate(() => {
    const el = document.getElementById('urlA');
    el.value = 'art/art-slots-sin-city.webp';
    el.dispatchEvent(new Event('input'));
  });
  await adminPage.evaluate(() => window.savePromoPair('a'));
  await adminPage.waitForTimeout(300);
  
  const toast = await adminPage.evaluate(() => document.getElementById('toastA').textContent);
  console.log('toastA:', toast);
  const ls = await adminPage.evaluate(() => localStorage.getItem('volt-promo-pair'));
  console.log('localStorage:', ls);
  
  const casinoPage = await ctx.newPage();
  await casinoPage.goto('file:///e:/Projects/casino/Volt%20Casino.html');
  await casinoPage.waitForTimeout(600);
  const imgSrc = await casinoPage.evaluate(() => document.getElementById('promoPairImgA').src);
  console.log('promoPairImgA.src:', imgSrc);
  
  await b.close();
})().catch(e => console.error('ERROR:', e.message));
