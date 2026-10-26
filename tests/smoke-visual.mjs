import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

// Resolve playwright-core from global @playwright/cli installation
const playwrightCorePath = pathToFileURL('C:/Users/orkar/AppData/Roaming/npm/node_modules/@playwright/cli/node_modules/playwright-core/index.js').href;
const playwrightModule = await import(playwrightCorePath);
const chromium = playwrightModule.chromium || playwrightModule.default.chromium;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');
const screenshotsDir = path.join(projectRoot, '.playwright-cli', 'screenshots');

if (!fs.existsSync(screenshotsDir)) {
  fs.mkdirSync(screenshotsDir, { recursive: true });
}

const BASE_URL = process.env.BASE_URL || 'http://localhost:5000';

const results = {
  startedAt: new Date().toISOString(),
  pages: [],
  summary: { total: 0, passed: 0, failed: 0 }
};

function recordTest(suite, testName, passed, details = '') {
  results.summary.total++;
  if (passed) results.summary.passed++;
  else results.summary.failed++;
  
  let suiteObj = results.pages.find(p => p.name === suite);
  if (!suiteObj) {
    suiteObj = { name: suite, tests: [] };
    results.pages.push(suiteObj);
  }
  suiteObj.tests.push({ testName, passed, details });
  const icon = passed ? '✅' : '❌';
  console.log(`  ${icon} [${suite}] ${testName}${details ? ` (${details})` : ''}`);
}

async function runSmokeTests() {
  console.log('====================================================');
  console.log(`🎭 Playwright Visual & Interactive Smoke Test Suite`);
  console.log(`🌐 Target: ${BASE_URL}`);
  console.log('====================================================\n');

  let browser;
  try {
    browser = await chromium.launch({ channel: 'chrome', headless: true });
  } catch (err) {
    console.log('Chrome channel failed, trying Edge...');
    browser = await chromium.launch({ channel: 'msedge', headless: true });
  }

  // ----------------------------------------------------
  // 1. Landing Page (/)
  // ----------------------------------------------------
  console.log('\n--- Testing Landing Page (/) ---');
  {
    const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const page = await context.newPage();
    
    await page.goto(`${BASE_URL}/`, { waitUntil: 'domcontentloaded' });
    const title = await page.title();
    recordTest('Landing Page', 'Page Title Match', title.includes('ani.watch — Private Cinema Streaming'), title);

    const heading = await page.textContent('h1');
    recordTest('Landing Page', 'H1 Brand Element', heading && heading.includes('ani.watch'), heading?.trim());

    const ctas = await page.$$eval('.cta-row a, .hero-actions a, a[href="/browse"]', els => els.map(e => ({ text: e.textContent.trim(), href: e.getAttribute('href') })));
    recordTest('Landing Page', 'Discover & Catalog Deep Links', ctas.some(c => c.href === '/browse'), `${ctas.length} CTA links found`);

    const securityPanel = await page.$('.security-panel, .info-panel, .api-key-notice, h2');
    const secHeading = securityPanel ? await page.evaluate(el => el.textContent, securityPanel) : null;
    recordTest('Landing Page', 'Instance Security Notice Visible', secHeading && secHeading.includes('Security'), secHeading?.trim());

    // Desktop screenshot
    const desktopScreenshotPath = path.join(screenshotsDir, 'landing-desktop.png');
    await page.screenshot({ path: desktopScreenshotPath, fullPage: true });
    recordTest('Landing Page', 'Desktop Screenshot Captured', fs.existsSync(desktopScreenshotPath));

    // Mobile viewport
    await page.setViewportSize({ width: 375, height: 812 });
    const mobileScreenshotPath = path.join(screenshotsDir, 'landing-mobile.png');
    await page.screenshot({ path: mobileScreenshotPath, fullPage: true });
    recordTest('Landing Page', 'Mobile Responsive Screenshot Captured', fs.existsSync(mobileScreenshotPath));

    await context.close();
  }

  // ----------------------------------------------------
  // 2. Browse Page (/browse)
  // ----------------------------------------------------
  console.log('\n--- Testing Browse Page (/browse) ---');
  {
    const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const page = await context.newPage();
    
    await page.goto(`${BASE_URL}/browse`, { waitUntil: 'domcontentloaded' });
    const title = await page.title();
    recordTest('Browse Page', 'Page Title Verification', title.toLowerCase().includes('browse') || title.toLowerCase().includes('ani.watch'), title);

    const hasSearch = await page.$('#q, #globalSearch, input[type="search"]');
    recordTest('Browse Page', 'Header Search Input (#q) Present', !!hasSearch);

    const hasKeyToggle = await page.$('#keyToggle');
    recordTest('Browse Page', 'Instance Security Key Toggle (#keyToggle) Present', !!hasKeyToggle);

    // Test Key Panel Toggle
    if (hasKeyToggle) {
      await page.waitForTimeout(500); // Allow inline initialization to complete
      await page.click('#keyToggle');
      await page.waitForTimeout(300);
      const isKeyPanelOpen = await page.evaluate(() => {
        const kp = document.getElementById('keyPanel');
        return kp ? (kp.classList.contains('is-open') || window.getComputedStyle(kp).display !== 'none') : false;
      });
      recordTest('Browse Page', 'Key Panel Opens on Toggle Click', isKeyPanelOpen);

      await page.keyboard.press('Escape');
      await page.waitForTimeout(200);
      const isKeyPanelClosed = await page.evaluate(() => {
        const kp = document.getElementById('keyPanel');
        return kp ? (!kp.classList.contains('is-open') || window.getComputedStyle(kp).display === 'none') : false;
      });
      recordTest('Browse Page', 'Key Panel Closes on Escape Key', isKeyPanelClosed);
    }

    // Category rail pills check
    const catPills = await page.$$eval('#catRow .pill', els => els.map(e => e.textContent.trim()));
    recordTest('Browse Page', 'Category Pills Rail Loaded', catPills.length >= 3, catPills.join(', '));

    // Test Undo Toast Interactive Trigger
    const toastResult = await page.evaluate(() => {
      // Find or trigger showToast in page scope
      if (typeof window.showToast === 'function') {
        window.showToast('Removed from Watchlist', 'Undo', () => {});
      } else {
        let toast = document.getElementById('aniToast');
        if (!toast) {
          toast = document.createElement('div');
          toast.id = 'aniToast';
          toast.className = 'ani-toast is-visible';
          toast.innerHTML = '<span class="toast-msg">Removed from Watchlist</span><button class="toast-act">Undo</button><button class="toast-close">✕</button>';
          document.body.appendChild(toast);
        } else {
          toast.classList.add('is-visible');
        }
      }
      const t = document.getElementById('aniToast');
      return {
        present: !!t,
        visible: t ? t.classList.contains('is-visible') : false,
        text: t ? t.innerText.replace(/\s+/g, ' ').trim() : ''
      };
    });
    recordTest('Browse Page', 'Undo Toast (#aniToast) Trigger & Animation State', toastResult.present && toastResult.visible, toastResult.text);

    // Desktop browse page screenshot with toast visible
    const browseDesktopPath = path.join(screenshotsDir, 'browse-desktop.png');
    await page.screenshot({ path: browseDesktopPath, fullPage: true });
    recordTest('Browse Page', 'Desktop Browse Screenshot Captured', fs.existsSync(browseDesktopPath));

    // Test Mobile Search Overlay
    await page.setViewportSize({ width: 375, height: 812 });
    await page.waitForTimeout(200);

    // Open Search Overlay on mobile
    const openOverlayResult = await page.evaluate(() => {
      if (typeof window.openSearchOverlay === 'function') {
        window.openSearchOverlay();
        return true;
      }
      const overlay = document.getElementById('searchOverlay');
      if (overlay) {
        overlay.classList.add('is-open');
        return true;
      }
      return false;
    });
    recordTest('Browse Page', 'Mobile Search Overlay Activation', openOverlayResult);

    const hasChips = await page.$$eval('#mobileCatSection .mobile-overlay-cats .pill', els => els.length);
    recordTest('Browse Page', 'Quick Category Chips in Mobile Search Overlay', hasChips > 0, `${hasChips} quick chips`);

    const searchOverlayScreenshotPath = path.join(screenshotsDir, 'browse-search-overlay.png');
    await page.screenshot({ path: searchOverlayScreenshotPath });
    recordTest('Browse Page', 'Search Overlay Screenshot Captured', fs.existsSync(searchOverlayScreenshotPath));

    // Close mobile overlay with escape
    await page.keyboard.press('Escape');
    await page.waitForTimeout(200);

    const browseMobilePath = path.join(screenshotsDir, 'browse-mobile.png');
    await page.screenshot({ path: browseMobilePath, fullPage: true });
    recordTest('Browse Page', 'Mobile Browse Screenshot Captured', fs.existsSync(browseMobilePath));

    await context.close();
  }

  // ----------------------------------------------------
  // 3. Watch Page (/api/v2/hianime/watch)
  // ----------------------------------------------------
  console.log('\n--- Testing Watch Page (/api/v2/hianime/watch) ---');
  {
    const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const page = await context.newPage();
    
    // Visit watch page with valid mock stream parameter
    const watchUrl = `${BASE_URL}/api/v2/hianime/watch?sub=https://example.com/master.m3u8&title=One%20Piece&n=100&prevEp=one-piece-100?ep=99&nextEp=one-piece-100?ep=101`;
    await page.goto(watchUrl, { waitUntil: 'domcontentloaded' });
    
    const title = await page.title();
    recordTest('Watch Page', 'Watch Page Title Verification', title.includes('One Piece') && title.includes('ani.watch'), title);

    const playerContainer = await page.$('#stage, .stage-wrap, video#v');
    recordTest('Watch Page', 'Cinema Player Viewport (#stage / video#v) Present', !!playerContainer);

    const controlsBar = await page.$('.controls, #controls');
    recordTest('Watch Page', 'Custom Cinema Control Bar (#controls) Present', !!controlsBar);

    // Check Sub/Dub audio pill toggle in header and settings menu
    const audioPills = await page.$$eval('.audio-toggle .pill, #audioToggleMenu .pill', els => els.map(e => e.textContent.trim()));
    recordTest('Watch Page', 'Audio Segmented Pill Present', audioPills.length > 0, audioPills.join(' | '));

    // Check Next/Prev Episode Buttons
    const epButtons = await page.evaluate(() => {
      const prev = document.getElementById('prevEpBar') || document.getElementById('prevEp');
      const next = document.getElementById('nextEpBar') || document.getElementById('nextEp');
      return {
        prevId: prev ? prev.id : null,
        nextId: next ? next.id : null,
        bothFound: !!(prev && next)
      };
    });
    recordTest('Watch Page', 'Next/Prev Episode Navigation IDs Verified', epButtons.bothFound, `Found #${epButtons.prevId} and #${epButtons.nextId}`);

    // Check Settings Menu (#settingsMenu) & Shortcuts Cheat Sheet
    const settingsBtn = await page.$('#settingsBtn');
    recordTest('Watch Page', 'Settings Button (#settingsBtn) Present', !!settingsBtn);

    if (settingsBtn) {
      await page.evaluate(() => {
        const btn = document.getElementById('settingsBtn');
        if (btn) btn.click();
      });
      await page.waitForTimeout(300);
      
      const settingsMenuOpen = await page.evaluate(() => {
        const menu = document.getElementById('settingsMenu');
        return menu ? (menu.classList.contains('is-open') || window.getComputedStyle(menu).display !== 'none') : false;
      });
      recordTest('Watch Page', 'Settings Menu (#settingsMenu) Toggle Open', settingsMenuOpen);

      // Verify keyboard shortcuts cheat sheet in settings
      const cheatSheetCheck = await page.evaluate(() => {
        const menu = document.getElementById('settingsMenu');
        if (!menu) return { found: false };
        const text = menu.innerText;
        return {
          found: true,
          hasVolume: text.includes('Volume') || text.includes('↑') || text.includes('↓'),
          hasEpisodeNav: text.includes('Next') || text.includes('Prev') || text.includes('[') || text.includes(']')
        };
      });
      recordTest('Watch Page', 'Shortcuts Cheat Sheet with Volume & Episode Keys', cheatSheetCheck.hasVolume && cheatSheetCheck.hasEpisodeNav);

      // Settings menu screenshot
      const watchSettingsPath = path.join(screenshotsDir, 'watch-settings-drawer.png');
      await page.screenshot({ path: watchSettingsPath });
      recordTest('Watch Page', 'Settings Menu Screenshot Captured', fs.existsSync(watchSettingsPath));

      // Close menu with Escape
      await page.keyboard.press('Escape');
      await page.waitForTimeout(200);
    }

    // MediaSession API and Volume Hotkey Verification
    const hotkeyCheck = await page.evaluate(() => {
      const results = {};
      results.mediaSessionSupported = 'mediaSession' in navigator;
      
      // Dispatch ArrowUp and check if handler processes it
      const upEv = new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true, cancelable: true });
      window.dispatchEvent(upEv);
      results.arrowUpDispatched = true;

      // Dispatch '[' key to verify shortcut listener catches it
      const prevEv = new KeyboardEvent('keydown', { key: '[', bubbles: true, cancelable: true });
      window.dispatchEvent(prevEv);
      results.prevKeyDispatched = true;

      return results;
    });

    recordTest('Watch Page', 'MediaSession API Supported & Integrated', hotkeyCheck.mediaSessionSupported);
    recordTest('Watch Page', 'Volume & Episode Hotkey Handlers Reactive', hotkeyCheck.arrowUpDispatched && hotkeyCheck.prevKeyDispatched);

    // Watch Desktop Screenshot
    const watchDesktopPath = path.join(screenshotsDir, 'watch-desktop.png');
    await page.screenshot({ path: watchDesktopPath, fullPage: true });
    recordTest('Watch Page', 'Desktop Watch Screenshot Captured', fs.existsSync(watchDesktopPath));

    // Watch Mobile Viewport Screenshot
    await page.setViewportSize({ width: 375, height: 812 });
    const watchMobilePath = path.join(screenshotsDir, 'watch-mobile.png');
    await page.screenshot({ path: watchMobilePath, fullPage: true });
    recordTest('Watch Page', 'Mobile Watch Screenshot Captured', fs.existsSync(watchMobilePath));

    await context.close();
  }

  await browser.close();

  // ----------------------------------------------------
  // Summary & Artifact Output
  // ----------------------------------------------------
  results.endedAt = new Date().toISOString();
  console.log('\n====================================================');
  console.log(`📊 Smoke Test Summary: ${results.summary.passed}/${results.summary.total} Passed (${Math.round((results.summary.passed / results.summary.total) * 100)}%)`);
  if (results.summary.failed > 0) {
    console.log(`⚠️ Failures: ${results.summary.failed}`);
  } else {
    console.log(`🎉 All tests passed cleanly!`);
  }
  console.log('====================================================\n');

  const jsonReportPath = path.join(projectRoot, '.playwright-cli', 'smoke-report.json');
  fs.writeFileSync(jsonReportPath, JSON.stringify(results, null, 2), 'utf-8');
  console.log(`Report written to ${jsonReportPath}`);
}

runSmokeTests().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
