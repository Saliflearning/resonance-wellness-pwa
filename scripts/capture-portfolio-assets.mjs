import { mkdir, readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { extname, isAbsolute, join, relative, resolve } from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const root = resolve('.');
const output = resolve('docs/images');
const port = 4193;
const baseUrl = `http://127.0.0.1:${port}`;
const mime = { '.html':'text/html; charset=utf-8', '.js':'text/javascript', '.json':'application/json', '.png':'image/png', '.svg':'image/svg+xml' };

await mkdir(output, { recursive: true });
const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url || '/', baseUrl);
    const file = resolve(join(root, url.pathname === '/' ? '/index.html' : url.pathname));
    const relativePath = relative(root, file);
    if (relativePath.startsWith('..') || isAbsolute(relativePath)) throw new Error('forbidden');
    const body = await readFile(file);
    res.writeHead(200, { 'content-type': mime[extname(file)] || 'application/octet-stream' });
    res.end(body);
  } catch {
    res.writeHead(404);
    res.end('Not found');
  }
});
await new Promise(resolveServer => server.listen(port, '127.0.0.1', resolveServer));

const executablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE;
const browser = await chromium.launch(executablePath ? { executablePath } : {});
try {
  for (const shot of [
    { name:'resonance-desktop.png', width:1440, height:900, mobile:false },
    { name:'resonance-mobile.png', width:390, height:844, mobile:true },
  ]) {
    const context = await browser.newContext({ viewport:{ width:shot.width, height:shot.height }, isMobile:shot.mobile, hasTouch:shot.mobile, reducedMotion:'reduce' });
    const page = await context.newPage();
    await page.goto(baseUrl, { waitUntil:'load' });
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
      localStorage.setItem('res-guest', 'true');
    });
    await page.reload({ waitUntil:'load' });
    await page.screenshot({ path:join(output, shot.name), fullPage:false });
    await context.close();
  }

  const context = await browser.newContext({ viewport:{ width:1280, height:640 }, deviceScaleFactor:1 });
  const page = await context.newPage();
  await page.goto(`file:///${resolve('docs/social-preview.svg').replaceAll('\\', '/')}`, { waitUntil:'load' });
  await page.screenshot({ path:join(output, 'social-preview.png') });
  await context.close();
} finally {
  await browser.close();
  server.close();
}

console.log('Portfolio assets captured with synthetic guest state.');
