const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();
  
  page.on('console', msg => console.log('BROWSER CONSOLE:', msg.text()));
  page.on('pageerror', error => console.error('BROWSER ERROR:', error));

  try {
    await page.goto('http://localhost:5173', { waitUntil: 'load' });
    console.log('Page loaded');
    
    // Check if hero-start-btn exists
    const heroBtn = await page.$('#hero-start-btn');
    if (heroBtn) {
      console.log('Clicking hero start btn');
      await heroBtn.click();
    }
    
    // Wait a bit
    await page.waitForTimeout(1000);
    
    // Look for video chat button
    const videoBtn = await page.$('#start-video-btn');
    if (videoBtn) {
      const isVisible = await videoBtn.isVisible();
      const isDisabled = await videoBtn.isDisabled();
      console.log('Video btn found. Visible:', isVisible, 'Disabled:', isDisabled);
      
      const enabled = await page.evaluate(() => {
        const btn = document.getElementById('start-video-btn');
        btn.removeAttribute('disabled');
        return true;
      });
      await page.waitForTimeout(500);
      
      console.log('Clicking video btn');
      await videoBtn.click({ force: true });
      await page.waitForTimeout(1000);
      
      const isVideoChatPresent = await page.evaluate(() => document.body.innerText.includes('video'));
      console.log('body inner text has video?', isVideoChatPresent, await page.evaluate(() => document.body.innerText.substring(0, 100)));
      
    } else {
      console.log('Video btn not found!');
      console.log(await page.evaluate(() => document.body.innerText.substring(0, 500)));
    }
  } catch (err) {
    console.error('Test error:', err);
  } finally {
    await browser.close();
  }
})();
