const { chromium } = require('./node_modules/playwright');
(async () => {
  const b = await chromium.launch();
  const p = await (await b.newContext()).newPage();
  
  await p.goto('file:///e:/Projects/casino/admin.html');
  await p.waitForTimeout(1000);
  
  const result = await p.evaluate(() => {
    const tabs = [...document.querySelectorAll('.tab-content')].map(el => el.id);
    const bodyLength = document.body.innerHTML.length;
    const hasPromos = document.body.innerHTML.includes('tab-promos');
    const hasUrlA = document.body.innerHTML.includes('id="urlA"');
    return { tabs, bodyLength, hasPromos, hasUrlA };
  });
  
  console.log(JSON.stringify(result, null, 2));
  await b.close();
})().catch(e => console.error('ERROR:', e.message));
