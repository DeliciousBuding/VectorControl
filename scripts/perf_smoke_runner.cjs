const { chromium } = require('@playwright/test');
const fs = require('fs');

async function measureRoute(browser, baseUrl, token, route) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1200 } });
  await context.addInitScript((sessionToken) => {
    window.localStorage.setItem('vectorcontrol_session_token', sessionToken);
  }, token);

  const page = await context.newPage();
  const startedAt = Date.now();
  await page.goto(`${baseUrl}${route.path}`, { waitUntil: 'networkidle' });
  if (route.selector) {
    await page.waitForSelector(route.selector, { timeout: 15000 });
  } else if (route.text) {
    await page.getByText(route.text).waitFor({ timeout: 15000 });
  }
  const readyMs = Date.now() - startedAt;
  const [navigation] = await page.evaluate(() => performance.getEntriesByType('navigation'));
  const result = {
    name: route.name,
    path: route.path,
    readyMs,
  };
  if (navigation) {
    result.domContentLoadedMs = Math.round(navigation.domContentLoadedEventEnd);
    result.loadEventMs = Math.round(navigation.loadEventEnd);
    result.responseEndMs = Math.round(navigation.responseEnd);
  }
  await context.close();
  return result;
}

async function main() {
  const configPath = process.argv[2];
  const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  const browser = await chromium.launch({ headless: true });
  try {
    const routes = [];
    for (const route of config.routes) {
      routes.push(await measureRoute(browser, config.baseUrl, config.token, route));
    }
    const payload = {
      generatedAt: new Date().toISOString(),
      baseUrl: config.baseUrl,
      routes,
    };
    fs.writeFileSync(config.outputPath, JSON.stringify(payload, null, 2), 'utf8');
    console.log(config.outputPath);
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
