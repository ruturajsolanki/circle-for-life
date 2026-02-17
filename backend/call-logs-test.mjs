#!/usr/bin/env node
/**
 * Login → Call Logs → Screenshot → Report
 */
import { chromium } from 'playwright';
import { mkdirSync } from 'fs';
import { join } from 'path';

const BASE = 'http://localhost:3000';
const OUT_DIR = join(process.cwd(), 'screenshots');

async function main() {
  mkdirSync(OUT_DIR, { recursive: true });
  const browser = await chromium.launch({ headless: true, channel: 'chrome' });
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();

  try {
    // 1. Login
    await page.goto(BASE, { waitUntil: 'networkidle' });
    await page.fill('#loginEmail', 'admin@circleforlife.app');
    await page.fill('#loginPass', 'admin123456');
    await page.click('#loginBtn');
    await page.waitForTimeout(5000);

    // 2. Click Call Logs in sidebar
    const callLogsNav = page.locator('.nav-item[data-s="calllogs"]');
    const visible = await callLogsNav.isVisible();
    if (!visible) {
      console.log('Call Logs nav item not visible - may need level 6+');
      await page.screenshot({ path: join(OUT_DIR, 'call-logs-nav-missing.png'), fullPage: true });
      return;
    }
    await callLogsNav.click();
    await page.waitForSelector('#p-calllogs', { state: 'visible', timeout: 5000 });
    await page.waitForTimeout(3000); // let data load

    // 3. Screenshot
    await page.screenshot({ path: join(OUT_DIR, 'call-logs.png'), fullPage: true });
    console.log('Screenshot saved: call-logs.png');

    // 4. Report
    const stats = await page.evaluate(() => ({
      total: document.getElementById('clStatTotal')?.textContent || 'N/A',
      phone: document.getElementById('clStatPhone')?.textContent || 'N/A',
      browser: document.getElementById('clStatBrowser')?.textContent || 'N/A',
      escalated: document.getElementById('clStatEscalated')?.textContent || 'N/A',
      active: document.getElementById('clStatActive')?.textContent || 'N/A',
    }));
    const filterBtns = await page.locator('.calllog-filter').count();
    const listContent = await page.locator('#callLogsList').innerText().catch(() => '');

    console.log('\n--- CALL LOGS REPORT ---');
    console.log('Stats cards:', stats);
    console.log('Filter buttons:', filterBtns);
    console.log('List content (first 600 chars):', listContent.substring(0, 600));
  } finally {
    await browser.close();
  }
}

main().catch(console.error);
