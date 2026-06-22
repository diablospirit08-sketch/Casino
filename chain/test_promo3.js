const { chromium } = require('./node_modules/playwright');
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext();
  const p = await ctx.newPage();
  
  const reqs = [];
  p.on('request', r => reqs.push(r.url()));
  p.on('pageerror', e => console.log('PAGE ERROR:', e.message));
  
  // Block all network to force predictable behavior
  await p.route('**/*', route => {
    const url = route.request().url();
    if (url.startsWith('file://')) return route.continue();
    // Fake the /api/auth/me response 
    if (url.includes('/api/auth/me')) return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({is_admin:true,username:'Admin',email:'admin@test.com'})});
    // Block all other network
    return route.abort();
  });
  
  await p.goto('file:///e:/Projects/casino/admin.html');
  await p.waitForTimeout(2000);
  
  const r = await p.evaluate(() => ({
    tabPromos: !!document.getElementById('tab-promos'),
    urlA: !!document.getElementById('urlA'),
    tabContents: [...document.querySelectorAll('.tab-content')].map(el => el.id),
    mainInnerStart: document.querySelector('.main') ? document.querySelector('.main').innerHTML.substring(0,100) : 'no .main'
  }));
  
  console.log('Result:', JSON.stringify(r, null, 2));
  console.log('Network requests:', reqs.slice(0, 10));
  
  await b.close();
})().catch(e => console.error('ERROR:', e.message));
