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
    const allIds = [...document.querySelectorAll('[id]')].map(el => el.id);
    const promoIds = allIds.filter(id => id.startsWith('url') || id.startsWith('promo') || id.startsWith('pce'));
    return {
      tabPromosExists: !!tabPromos,
      tabPromosChildren: tabPromos ? tabPromos.children.length : 0,
      tabPromosHTML: tabPromos ? tabPromos.innerHTML.substring(0, 200) : 'null',
      urlAExists: !!urlA,
      promoRelatedIds: promoIds,
      pageErrors: errors
    };
  });
  
  console.log(JSON.stringify(result, null, 2));
  console.log('Page errors:', errors);
  
  await b.close();
})().catch(e => console.error('ERROR:', e.message));
