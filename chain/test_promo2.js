const { chromium } = require('./node_modules/playwright');
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext();
  const p = await ctx.newPage();
  
  // Inject mock auth so admin doesn't replace the DOM
  await p.route('**/api/auth/me', route => route.fulfill({
    status: 200, contentType: 'application/json',
    body: JSON.stringify({ is_admin: true, username: 'TestAdmin', email: 'test@test.com' })
  }));
  await p.route('**/api/**', route => route.fulfill({
    status: 200, contentType: 'application/json', body: JSON.stringify({})
  }));
  
  await p.goto('file:///e:/Projects/casino/admin.html');
  await p.waitForTimeout(1500);
  
  const tabExists = await p.evaluate(() => !!document.getElementById('tab-promos'));
  console.log('tab-promos exists:', tabExists);
  const urlAExists = await p.evaluate(() => !!document.getElementById('urlA'));
  console.log('urlA exists:', urlAExists);
  const fnType = await p.evaluate(() => typeof window.savePromoPair);
  console.log('savePromoPair:', fnType);
  
  if (!urlAExists) { console.log('ABORT: elements not found'); await b.close(); return; }
  
  // Set image URL and save
  await p.evaluate(() => {
    document.getElementById('urlA').value = 'art/art-slots-sin-city.webp';
  });
  await p.evaluate(() => window.savePromoPair('a'));
  await p.waitForTimeout(300);
  
  const toast = await p.evaluate(() => document.getElementById('toastA').textContent);
  console.log('toastA:', toast);
  
  const ls = await p.evaluate(() => localStorage.getItem('volt-promo-pair'));
  console.log('saved LS:', ls);
  
  // Open casino page in same context
  const casino = await ctx.newPage();
  await casino.goto('file:///e:/Projects/casino/Volt%20Casino.html');
  await casino.waitForTimeout(800);
  
  const imgSrc = await casino.evaluate(() => {
    const el = document.getElementById('promoPairImgA');
    return el ? el.src : 'NOT FOUND';
  });
  console.log('promoPairImgA.src:', imgSrc);
  
  await b.close();
})().catch(e => console.error('ERROR:', e.message));
