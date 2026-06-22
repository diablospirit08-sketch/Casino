const { chromium } = require('./node_modules/playwright');
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext();
  const p = await ctx.newPage();
  
  const errors = [];
  p.on('pageerror', e => errors.push(e.message));
  
  await p.goto('file:///e:/Projects/casino/admin.html');
  await p.waitForTimeout(1000);
  
  const result = await p.evaluate(() => {
    const tabPromos = document.getElementById('tab-promos');
    const urlA = document.getElementById('urlA');
    const promoIds = [...document.querySelectorAll('[id]')].map(el => el.id).filter(id => id.match(/url|promo|pce|lp|preview/i));
    return {
      tabPromosExists: !!tabPromos,
      tabPromosChildCount: tabPromos ? tabPromos.children.length : 0,
      tabPromosFirstHTML: tabPromos ? tabPromos.innerHTML.substring(0, 300) : 'null',
      urlAExists: !!urlA,
      promoRelatedIds: promoIds
    };
  });
  
  console.log(JSON.stringify(result, null, 2));
  console.log('Page errors:', errors);
  
  await b.close();
})().catch(e => console.error('ERROR:', e.message));
