#!/usr/bin/env node
/**
 * Login → P2P Chat → Screenshot → Click conversation → Screenshot → Report
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

    // 2. P2P Chat
    await page.click('.nav-item[data-s="p2p"]');
    await page.waitForTimeout(5000);

    // 3. First screenshot (before clicking conversation)
    await page.screenshot({ path: join(OUT_DIR, 'p2p-before-select.png'), fullPage: true });
    console.log('Screenshot 1: p2p-before-select.png');

    // Report state before click
    const convoItems = await page.locator('#convoList .convo-item').count();
    const onlineBadges = await page.locator('.convo-online-label').count();
    const onlineBadgesVisible = await page.evaluate(() => {
      const labels = document.querySelectorAll('.convo-online-label');
      return Array.from(labels).filter(el => el.style.display !== 'none' && el.offsetParent !== null).length;
    });
    const offlineText = await page.locator('#convoList').locator('text=offline').count();
    const greenDots = await page.locator('.status-dot.online').count();
    const grayDots = await page.locator('.status-dot.offline').count();
    const convoListHTML = await page.locator('#convoList').innerHTML().catch(() => '');

    console.log('\n--- BEFORE SELECTING CONVERSATION ---');
    console.log('Conversations visible:', convoItems);
    console.log('Online badge elements:', onlineBadges);
    console.log('Online badges visible:', onlineBadgesVisible);
    console.log('Offline text in list:', offlineText);
    console.log('Green status dots:', greenDots);
    console.log('Gray status dots:', grayDots);

    // 4. Click first conversation
    const firstConvo = page.locator('#convoList .convo-item').first();
    await firstConvo.click();
    await page.waitForTimeout(3000);

    // 5. Second screenshot (after selecting conversation)
    await page.screenshot({ path: join(OUT_DIR, 'p2p-after-select.png'), fullPage: true });
    console.log('\nScreenshot 2: p2p-after-select.png');

    // Report state after click
    const chatHeaderName = await page.locator('#chatHeaderName').textContent().catch(() => 'N/A');
    const chatHeaderStatus = await page.locator('#chatHeaderStatus').textContent().catch(() => 'N/A');
    const chatHeaderDot = await page.locator('#chatHeaderDot').getAttribute('class').catch(() => 'N/A');
    const errors = await page.locator('.alert-box.show, .toast.show, [class*="error"]').count();
    const errorText = await page.locator('.alert-box, .toast').filter({ hasText: /./ }).first().textContent().catch(() => '');

    console.log('\n--- AFTER SELECTING CONVERSATION ---');
    console.log('Chat header name:', chatHeaderName);
    console.log('Chat header status:', chatHeaderStatus);
    console.log('Chat header dot class:', chatHeaderDot);
    console.log('Error elements visible:', errors);
    if (errorText) console.log('Error message:', errorText);
  } finally {
    await browser.close();
  }
}

main().catch(console.error);
