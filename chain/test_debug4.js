const { chromium } = require('./node_modules/playwright');
(async () => {
  const b = await chromium.launch();
  const p = await (await b.newContext()).newPage();
  
  await p.goto('file:///e:/Projects/casino/admin.html');
  await p.waitForTimeout(1000);
  
  const result = await p.evaluate(() => {
    // Find what the last element in DOM body is
    const allEls = [...document.body.querySelectorAll('*')];
    const lastEl = allEls[allEls.length - 1];
    const bodyEnd = document.body.innerHTML.slice(-500);
    return {
      totalElements: allEls.length,
      lastElTag: lastEl ? lastEl.tagName : null,
      lastElId: lastEl ? lastEl.id : null,
      lastElClass: lastEl ? lastEl.className : null,
      bodyEnd
    };
  });
  
  console.log(JSON.stringify(result, null, 2));
  await b.close();
})().catch(e => console.error('ERROR:', e.message));
