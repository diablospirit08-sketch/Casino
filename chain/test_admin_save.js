const { chromium } = require('./node_modules/playwright');
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext();
  const p = await ctx.newPage();

  // Block all non-file requests silently; mock auth/me  
  await p.route('**/*', async route => {
    const url = route.request().url();
    if (url.startsWith('file://')) return route.continue();
    if (url.includes('/api/auth/me') || url.includes('/api/admin/stats') || url.includes('/api/admin/bets') || url.includes('/api/admin/users') || url.includes('/api/admin/transactions') || url.includes('/api/admin/games')) {
      return route.fulfill({status:200, contentType:'application/json', body:JSON.stringify({is_admin:true,username:'Admin',email:'a@a.com',data:[],rows:[],stats:{}})});
    }
    return route.abort('blockedbyclient');
  });

  await p.goto('file:///e:/Projects/casino/admin.html');
  await p.waitForTimeout(2500);

  const check = await p.evaluate(() => ({
    tabPromos: !!document.getElementById('tab-promos'),
    urlA: !!document.getElementById('urlA'),
    saveType: typeof window.savePromoPair,
    mainStart: (document.querySelector('.main') || {}).innerHTML?.substring(0,80) || 'no main'
  }));
  console.log('After load:', JSON.stringify(check, null, 2));

  if (!check.urlA) {
    // Try: is it hiding behind auth error? Force show the tab
    await p.evaluate(() => {
      // Restore main if auth error replaced it
      const main = document.querySelector('.main');
      const content = document.querySelector('.content');
      console.log('main:', main?.className, 'content:', content?.className);
    });
    console.log('urlA still not found — admin shows auth error');
    await b.close();
    return;
  }

  await p.evaluate(() => {
    document.getElementById('urlA').value = 'art/art-slots-sin-city.webp';
    window.savePromoPair('a');
  });
  await p.waitForTimeout(400);

  const result = await p.evaluate(() => ({
    toast: document.getElementById('toastA')?.textContent,
    ls: localStorage.getItem('volt-promo-pair')
  }));
  console.log('After save:', JSON.stringify(result, null, 2));
  await b.close();
})().catch(e => console.error('ERROR:', e.message));
