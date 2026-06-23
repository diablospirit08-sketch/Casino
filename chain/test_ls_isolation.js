const { chromium } = require('./node_modules/playwright');
(async () => {
  // Launch like a real user would - no special file access flags
  const b = await chromium.launch({ args: [] });
  const ctx = await b.newContext();
  
  const admin = await ctx.newPage();
  await admin.goto('file:///e:/Projects/casino/admin.html');
  const errors = [];
  admin.on('console', m => { if(m.type()==='error'||m.type()==='warning') errors.push(m.text().substring(0,80)); });
  
  // Write volt-promo-pair from admin page
  await admin.evaluate(() => {
    localStorage.setItem('volt-promo-pair', JSON.stringify({a:{img:'art/test.webp',head:'FROM ADMIN'}}));
  });
  const adminRead = await admin.evaluate(() => localStorage.getItem('volt-promo-pair'));
  console.log('admin LS write+read:', !!adminRead);
  
  // Read from casino page
  const casino = await ctx.newPage();
  await casino.goto('file:///e:/Projects/casino/Volt%20Casino.html');
  await casino.waitForTimeout(400);
  const casinoRead = await casino.evaluate(() => localStorage.getItem('volt-promo-pair'));
  console.log('casino sees admin LS:', casinoRead);
  
  console.log('Console errors during test:', errors.slice(0,5));
  
  await admin.evaluate(() => localStorage.removeItem('volt-promo-pair'));
  await b.close();
})().catch(e => console.error('ERROR:', e.message));
