const { chromium } = require('./node_modules/playwright');
const fs = require('fs');

(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext();
  
  // Read a real small image file and convert to base64 data URL manually
  const imgPath = 'e:/Projects/casino/art/art-slots-eternal-clash.webp';
  const imgBuf = fs.readFileSync(imgPath);
  const base64 = imgBuf.toString('base64');
  const dataUrl = 'data:image/webp;base64,' + base64;
  console.log('Image size (bytes):', imgBuf.length, '| Base64 length:', base64.length);
  
  // Seed localStorage with the base64 image (simulating what admin upload does)
  const p = await ctx.newPage();
  await p.goto('file:///e:/Projects/casino/Volt%20Casino.html');
  await p.evaluate((du) => {
    localStorage.setItem('volt-promo-pair', JSON.stringify({
      a: { img: du, head: 'UPLOADED IMAGE TEST', sub: 'uploaded sub', btn: 'Click' }
    }));
  }, dataUrl);
  
  // Reload to trigger IIFE
  await p.reload();
  await p.waitForTimeout(800);
  
  const result = await p.evaluate(() => {
    const el = document.getElementById('promoPairImgA');
    return { srcLength: el ? el.src.length : 0, srcStart: el ? el.src.substring(0, 30) : 'NOT FOUND', head: document.getElementById('promoPairHeadA')?.textContent };
  });
  console.log('Casino page result:', result);
  
  // Screenshot
  await p.screenshot({ path: 'e:/Projects/casino/_verify_shots/promo_upload_test.png', fullPage: false });
  console.log('Screenshot saved');
  
  await p.evaluate(() => localStorage.removeItem('volt-promo-pair'));
  await b.close();
})().catch(e => console.error('ERROR:', e.message));
