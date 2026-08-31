import { createServer } from 'node:http';
import { readFile, writeFile } from 'node:fs/promises';
import { extname, isAbsolute, join, relative, resolve } from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_PACKAGE || 'playwright');

const root = resolve('.');
const port = Number(process.env.PORT || 4177);
const baseUrl = process.env.BASE_URL || `http://127.0.0.1:${port}`;

const mime = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
};

function startServer() {
  const server = createServer(async (req, res) => {
    try {
      const url = new URL(req.url || '/', baseUrl);
      const cleanPath = url.pathname === '/' ? '/index.html' : url.pathname;
      const file = resolve(join(root, cleanPath));
      const relativePath = relative(root, file);
      if (relativePath.startsWith('..') || isAbsolute(relativePath)) {
        res.writeHead(403);
        res.end('Forbidden');
        return;
      }
      const body = await readFile(file);
      res.writeHead(200, { 'content-type': mime[extname(file)] || 'application/octet-stream' });
      res.end(body);
    } catch {
      res.writeHead(404);
      res.end('Not found');
    }
  });

  return new Promise(resolveServer => {
    server.listen(port, '127.0.0.1', () => resolveServer(server));
  });
}

const viewports = [
  { name: 'iphone-se', width: 375, height: 667, isMobile: true },
  { name: 'iphone-15', width: 393, height: 852, isMobile: true },
  { name: 'tablet', width: 768, height: 1024, isMobile: false },
  { name: 'desktop', width: 1440, height: 900, isMobile: false },
];

const riskyText = [
  'delete',
  'reset',
  'sign out',
  'clear all',
  'clear',
  'forgot password',
  'create account',
  'sign in',
  'save key',
  'download',
];

function actionableErrors(errors) {
  return errors.filter(error => {
    if (error.includes('net::ERR_NETWORK_ACCESS_DENIED')) return false;
    if (error.includes('FedCM get() rejects')) return false;
    return true;
  });
}

async function collectLayout(page) {
  return page.evaluate(() => {
    const doc = document.documentElement;
    const body = document.body;
    const wide = [];
    document.querySelectorAll('body *').forEach(el => {
      const rect = el.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0 && rect.right > window.innerWidth + 2) {
        wide.push({
          tag: el.tagName.toLowerCase(),
          id: el.id || '',
          className: String(el.className || '').slice(0, 80),
          right: Math.round(rect.right),
          viewport: window.innerWidth,
          text: (el.textContent || '').trim().slice(0, 80),
        });
      }
    });
    return {
      width: window.innerWidth,
      height: window.innerHeight,
      scrollWidth: Math.max(doc.scrollWidth, body.scrollWidth),
      clientWidth: doc.clientWidth,
      hasHorizontalOverflow: Math.max(doc.scrollWidth, body.scrollWidth) > doc.clientWidth + 2,
      overflowingElements: wide.slice(0, 20),
    };
  });
}

async function visibleTargets(page) {
  return page.evaluate(risky => {
    const candidates = [...document.querySelectorAll('button,[onclick],a[href],input,textarea,select,[role="button"],[role="tab"]')];
    return candidates.map((el, index) => {
      const rect = el.getBoundingClientRect();
      const text = (el.innerText || el.getAttribute('aria-label') || el.value || el.textContent || '').trim().replace(/\s+/g, ' ');
      const lower = text.toLowerCase();
      const riskyMatch = risky.some(word => lower.includes(word));
      return {
        index,
        tag: el.tagName.toLowerCase(),
        id: el.id || '',
        className: String(el.className || ''),
        text: text.slice(0, 120),
        visible: rect.width > 0 && rect.height > 0 && rect.bottom >= 0 && rect.right >= 0 && rect.top <= window.innerHeight && rect.left <= window.innerWidth,
        x: Math.round(rect.left + rect.width / 2),
        y: Math.round(rect.top + rect.height / 2),
        risky: riskyMatch,
      };
    }).filter(t => t.visible);
  }, riskyText);
}

async function runViewport(browser, viewport) {
  const context = await browser.newContext({
    viewport: { width: viewport.width, height: viewport.height },
    isMobile: viewport.isMobile,
    hasTouch: viewport.isMobile,
    reducedMotion: 'reduce',
    permissions: [],
  });
  const page = await context.newPage();
  const consoleErrors = [];
  const pageErrors = [];
  const clicked = [];
  const skipped = [];

  page.on('console', msg => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });
  page.on('pageerror', err => pageErrors.push(err.message));
  page.on('dialog', dialog => dialog.dismiss().catch(() => {}));
  page.on('download', download => download.cancel().catch(() => {}));

  await page.goto(baseUrl, { waitUntil: 'load' });
  await page.waitForTimeout(500);

  const initialLayout = await collectLayout(page);
  const initialTargets = await visibleTargets(page);

  for (let round = 0; round < 8; round++) {
    const targets = await visibleTargets(page);
    let clickedThisRound = 0;
    for (const target of targets) {
      const label = `${target.tag}#${target.id}.${target.className.split(/\s+/).slice(0, 2).join('.')} ${target.text}`.trim();
      if (target.risky) {
        skipped.push(label);
        continue;
      }
      const key = `${round}:${label}:${target.x}:${target.y}`;
      if (clicked.includes(key)) continue;
      try {
        await page.mouse.click(target.x, target.y);
        clicked.push(key);
        clickedThisRound++;
        await page.waitForTimeout(80);
      } catch (err) {
        pageErrors.push(`Click failed: ${label}: ${err.message}`);
      }
      if (clicked.length >= 140) break;
    }
    if (clickedThisRound === 0 || clicked.length >= 140) break;
  }

  const finalLayout = await collectLayout(page);
  const title = await page.title();
  await context.close();

  return {
    viewport: viewport.name,
    title,
    initialTargetCount: initialTargets.length,
    clickedCount: clicked.length,
    skippedRiskyCount: [...new Set(skipped)].length,
    initialLayout,
    finalLayout,
    consoleErrors: [...new Set(consoleErrors)].slice(0, 20),
    pageErrors: [...new Set(pageErrors)].slice(0, 20),
  };
}

const server = process.env.BASE_URL ? null : await startServer();
const launchOptions = { headless: true };
if (process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE) {
  launchOptions.executablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE;
}
const browser = await chromium.launch(launchOptions);
const results = [];

try {
  for (const viewport of viewports) {
    results.push(await runViewport(browser, viewport));
  }
} finally {
  await browser.close();
  if (server) server.close();
}

const summary = {
  ok: results.every(r => {
    return !r.initialLayout.hasHorizontalOverflow
      && !r.finalLayout.hasHorizontalOverflow
      && actionableErrors(r.consoleErrors).length === 0
      && actionableErrors(r.pageErrors).length === 0;
  }),
  generatedAt: new Date().toISOString(),
  results,
};

if (process.env.STRESS_REPORT_PATH) {
  await writeFile(process.env.STRESS_REPORT_PATH, JSON.stringify(summary, null, 2));
}
console.log(JSON.stringify(summary, null, 2));
if (!summary.ok) process.exitCode = 1;
