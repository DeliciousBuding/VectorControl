const { chromium } = require('playwright');

const API_TOKEN = '_pgVl3GHxfKTUsD7HQWkbhgjSLWV1wrh';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ 
    viewport: { width: 1400, height: 900 },
    navigationTimeout: 60000
  });
  
  const screenshots = [];
  
  try {
    // 设置localStorage中的token
    const page = await context.newPage();
    console.log('1. 访问登录页面并设置token...');
    await page.goto('https://vectorcontrol.tech', { timeout: 60000 });
    await page.waitForTimeout(2000);
    await page.evaluate((token) => {
      localStorage.setItem('vectorcontrol_session_token', token);
    }, API_TOKEN);
    console.log('   Token已设置');
    
    // 刷新页面，应该自动登录
    console.log('2. 刷新页面加载数据...');
    await page.goto('https://vectorcontrol.tech', { timeout: 60000 });
    await page.waitForTimeout(8000);
    await page.screenshot({ path: 'D:\\tmp\\01_home_with_data.png', fullPage: true });
    screenshots.push('01_home_with_data.png');
    console.log('   首页已截图');
    
    // 检查基金数量
    const fundLinks = await page.locator('.fund-name').all();
    console.log(`   找到 ${fundLinks.length} 个基金`);
    
    // 点击第一个基金
    if (fundLinks.length > 0) {
      console.log('3. 点击基金查看详情...');
      await fundLinks[0].click();
      await page.waitForTimeout(5000);
      await page.screenshot({ path: 'D:\\tmp\\02_fund_detail.png', fullPage: true });
      screenshots.push('02_fund_detail.png');
      console.log('   基金详情页已截图');
    }
    
    // 返回首页并滚动
    console.log('4. 返回首页并滚动...');
    await page.goto('https://vectorcontrol.tech', { timeout: 60000 });
    await page.waitForTimeout(5000);
    await page.evaluate(() => window.scrollTo(0, 800));
    await page.waitForTimeout(1000);
    await page.screenshot({ path: 'D:\\tmp\\03_home_scrolled.png', fullPage: true });
    screenshots.push('03_home_scrolled.png');
    
    // 移动端测试
    console.log('5. 移动端视图...');
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('https://vectorcontrol.tech', { timeout: 60000 });
    await page.waitForTimeout(5000);
    await page.screenshot({ path: 'D:\\tmp\\04_mobile.png', fullPage: true });
    screenshots.push('04_mobile.png');
    
    // 平板测试
    console.log('6. 平板视图...');
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.goto('https://vectorcontrol.tech', { timeout: 60000 });
    await page.waitForTimeout(5000);
    await page.screenshot({ path: 'D:\\tmp\\05_tablet.png', fullPage: true });
    screenshots.push('05_tablet.png');
    
    console.log('\n=== 所有截图完成 ===');
    screenshots.forEach(s => console.log('  ✓ ' + s));
    
  } catch (e) {
    console.log('Error:', e.message);
    try {
      const page = await context.newPage();
      await page.screenshot({ path: 'D:\\tmp\\error.png', fullPage: true });
      console.log('  ✗ error.png - 错误截图');
    } catch {}
  }
  
  await browser.close();
})();
