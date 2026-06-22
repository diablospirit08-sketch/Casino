const { chromium } = require('./node_modules/playwright');
const fs = require('fs');

// Read promo JS from admin
const adminHtml = fs.readFileSync('e:/Projects/casino/admin.html', 'utf8');
const promoJsMatch = adminHtml.match(/\/\* ══ PROMO PAIR EDITOR ══[^]*?initPromoPairEditor\(\);/);
const promoJs = promoJsMatch ? promoJsMatch[0] : 'NOT FOUND';

const testHtml = `<!DOCTYPE html><html><head><meta charset="utf-8"></head><body>
<div id="tab-promos">
  <div id="previewImgA-wrap"><img id="previewImgA" src="art/art-slots-eternal-clash.webp"></div>
  <span id="previewTitleA">Take on the Challenge!</span>
  <input id="urlA" type="text" value="">
  <input id="headA" type="text" value="Take on the Challenge!">
  <input id="subA" type="text" value="Sub A">
  <input id="btnA" type="text" value="View Challenges">
  <input type="file" id="fileA">
  <div id="toastA"></div>
  <img id="lpImgA" src="art/art-slots-eternal-clash.webp">
  <div id="lpHeadA">Take on the Challenge!</div>
  <div id="lpSubA">Sub A</div>
  <div id="lpBtnA">View Challenges</div>
  <button onclick="savePromoPair('a')">Save A</button>

  <img id="previewImgB" src="art/poster-made-man.webp">
  <span id="previewTitleB">Compete &amp; Win</span>
  <input id="urlB" type="text" value="">
  <input id="headB" type="text" value="Compete & Win">
  <input id="subB" type="text" value="Sub B">
  <input id="btnB" type="text" value="View Tournaments">
  <input type="file" id="fileB">
  <div id="toastB"></div>
  <img id="lpImgB" src="art/poster-made-man.webp">
  <div id="lpHeadB">Compete &amp; Win</div>
  <div id="lpSubB">Sub B</div>
  <div id="lpBtnB">View Tournaments</div>
  <button onclick="savePromoPair('b')">Save B</button>
</div>
<script>const $=id=>document.getElementById(id);</script>
<script>${promoJs}</script>
</body></html>`;

fs.writeFileSync('e:/Projects/casino/chain/test_promo_minimal.html', testHtml);

(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext();
  const p = await ctx.newPage();
  const errs = [];
  p.on('pageerror', e => errs.push(e.message));
  
  await p.goto('file:///e:/Projects/casino/chain/test_promo_minimal.html');
  await p.waitForTimeout(500);
  
  if (errs.length) { console.log('JS ERRORS:', errs); }
  
  const initOk = await p.evaluate(() => typeof window.savePromoPair);
  console.log('savePromoPair:', initOk);
  
  // Set URL and save
  await p.evaluate(() => {
    document.getElementById('urlA').value = 'art/art-slots-sin-city.webp';
    window.savePromoPair('a');
  });
  await p.waitForTimeout(200);
  
  const result = await p.evaluate(() => ({
    toast: document.getElementById('toastA').textContent,
    ls: localStorage.getItem('volt-promo-pair'),
    lpImg: document.getElementById('lpImgA').src
  }));
  console.log('Result:', JSON.stringify(result, null, 2));
  
  await p.evaluate(() => localStorage.removeItem('volt-promo-pair'));
  await b.close();
})().catch(e => console.error('ERROR:', e.message));
