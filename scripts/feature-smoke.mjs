import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, isAbsolute, join, relative, resolve } from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_PACKAGE || 'playwright');

const root = resolve('.');
const port = Number(process.env.PORT || 4181);
const baseUrl = process.env.BASE_URL || `http://127.0.0.1:${port}`;

const mime = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
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

async function visible(page, selector) {
  try {
    await page.locator(selector).waitFor({ state: 'visible', timeout: 5000 });
    return true;
  } catch {
    return false;
  }
}

async function click(page, selector, label) {
  const target = page.locator(selector);
  await target.waitFor({ state: 'visible', timeout: 7000 });
  await target.click({ timeout: 7000 });
  return label;
}

async function run() {
  const server = process.env.BASE_URL ? null : await startServer();
  const launchOptions = { headless: true };
  if (process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE) {
    launchOptions.executablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE;
  }
  const browser = await chromium.launch(launchOptions);
  const context = await browser.newContext({ viewport: { width: 393, height: 852 }, isMobile: true, hasTouch: true });
  const page = await context.newPage();
  const consoleErrors = [];
  const pageErrors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });
  page.on('pageerror', err => pageErrors.push(err.message));

  const passed = [];

  try {
    await page.goto(baseUrl, { waitUntil: 'load' });
    await page.evaluate(() => {
      localStorage.setItem('res-guest', 'true');
      localStorage.setItem('res-journal', JSON.stringify([{
        name: '<img id="journal-xss-probe" src=x onerror="window.__xssProbe=1">',
        note: '<svg id="journal-note-xss" onload="window.__xssProbe=1">',
        date: 'Synthetic test',
        stars: 5,
      }]));
      localStorage.setItem('res-favs', JSON.stringify([{
        id: 'security-probe',
        name: '<img id="favorite-xss-probe" src=x onerror="window.__xssProbe=1">',
        icon: '<svg onload="window.__xssProbe=1">',
        color: 'red;position:fixed',
        steps: [{ hz: 528, min: 10 }],
      }]));
    });
    await page.reload({ waitUntil: 'load' });

    if ((await page.title()) !== 'Resonance') throw new Error('Page title did not load');
    passed.push('app loads');

    const storageSafety = await page.evaluate(() => {
      window.renderJournalLog?.();
      window.renderFavStrip?.();
      return {
        executed: !!window.__xssProbe,
        injectedNode: !!document.querySelector('#journal-xss-probe,#journal-note-xss,#favorite-xss-probe'),
        journalEncoded: document.getElementById('journalLog')?.textContent?.includes('<img id="journal-xss-probe"'),
        favoriteEncoded: document.getElementById('favScroll')?.textContent?.includes('<img id="favorite-xss-probe"'),
      };
    });
    if (storageSafety.executed || storageSafety.injectedNode || !storageSafety.journalEncoded || !storageSafety.favoriteEncoded) {
      throw new Error(`Stored-data encoding failed: ${JSON.stringify(storageSafety)}`);
    }
    passed.push('stored journal and favorite data are encoded');

    await click(page, '#nav-practice', 'practice nav');
    if (!(await visible(page, '#page-practice.active'))) throw new Error('Practice page not active');
    passed.push('practice page opens');

    await click(page, '#stab-boosts', 'boosts sub-tab');
    if (!(await visible(page, '#sub-boosts.active'))) throw new Error('Boosts sub-tab not active');
    passed.push('boosts tab opens');

    await click(page, '#nav-today', 'home nav');
    if (!(await visible(page, '#page-today.active'))) throw new Error('Home page not active');
    passed.push('home page returns');

    await click(page, '#hamburgerBtn', 'drawer open');
    if (!(await visible(page, '#drawerMenu.open'))) throw new Error('Drawer not open');
    passed.push('drawer opens');

    await click(page, '#di-privacy-safety', 'privacy modal');
    if (!(await visible(page, '#privacySafetyModal.open'))) throw new Error('Privacy modal not open');
    passed.push('privacy safety opens');

    await click(page, '#privacySafetyModal button[aria-label="Close privacy and safety"]', 'privacy close');
    passed.push('privacy safety closes');

    await page.evaluate(() => {
      window.showAuthOverlay?.();
      window.openAuthForm?.('login');
    });
    await page.locator('#authFormWrap.open').waitFor({ state: 'visible', timeout: 7000 });
    await page.fill('#authPassword', 'sample-password');
    await click(page, '#authPasswordToggle', 'password show');
    const passwordTypeShown = await page.locator('#authPassword').evaluate(input => input.type);
    if (passwordTypeShown !== 'text') throw new Error('Password did not switch to visible text');
    await click(page, '#authPasswordToggle', 'password hide');
    const passwordTypeHidden = await page.locator('#authPassword').evaluate(input => input.type);
    if (passwordTypeHidden !== 'password') throw new Error('Password did not switch back to hidden');
    if (!(await visible(page, '#authResetBtn'))) throw new Error('Forgot password button not visible');
    await page.evaluate(() => {
      window.closeAuthForm?.();
      window.hideAuthOverlay?.();
    });
    passed.push('auth form password controls work');

    await click(page, '#hamburgerBtn', 'drawer reopen');
    await click(page, '#di-settings', 'settings open');
    if (!(await visible(page, '#settingsPage.open'))) throw new Error('Settings page not open');
    passed.push('settings opens');

    await click(page, '#settingsPage .settings-page-back', 'settings close');
    passed.push('settings closes');

    await click(page, '#nav-practice', 'practice nav for plan builder');
    await click(page, '#stab-plan', 'plan sub-tab');
    await click(page, '#sub-plan button:has-text("Build My Plan")', 'plan builder open');
    if (!(await visible(page, '#planBuilderModal.open'))) throw new Error('Plan builder not open');
    passed.push('plan builder opens');

    await click(page, '#planBuilderModal button[aria-label="Close plan builder"]', 'plan builder close');
    passed.push('plan builder closes');

    const actionableErrors = consoleErrors.filter(error => {
      if (error.includes('net::ERR_NETWORK_ACCESS_DENIED')) return false;
      if (error.includes('FedCM get() rejects')) return false;
      return true;
    });
    if (actionableErrors.length || pageErrors.length) {
      throw new Error(`Console/page errors: ${[...actionableErrors, ...pageErrors].join(' | ')}`);
    }

    console.log(JSON.stringify({ ok: true, baseUrl, passed }, null, 2));
  } finally {
    await context.close();
    await browser.close();
    if (server) server.close();
  }
}

run().catch(err => {
  console.error(JSON.stringify({ ok: false, error: err.message }, null, 2));
  process.exitCode = 1;
});
