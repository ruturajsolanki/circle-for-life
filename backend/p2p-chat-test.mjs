#!/usr/bin/env node
/**
 * Login → Dashboard → P2P Chat → Screenshot and report
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
    // 1. Navigate and login
    await page.goto(BASE, { waitUntil: 'networkidle' });
    await page.fill('#loginEmail', 'admin@circleforlife.app');
    await page.fill('#loginPass', 'admin123456');
    await page.click('#loginBtn');
    await page.waitForTimeout(5000);

    // 2. Click P2P Chat in sidebar
    await page.click('.nav-item[data-s="p2p"]');
    await page.waitForTimeout(3000);

    // 3. Screenshot
    await page.screenshot({ path: join(OUT_DIR, 'p2p-chat.png'), fullPage: true });
    console.log('Screenshot saved: p2p-chat.png');

    // 4. Report
    const convoPane = await page.locator('#p2pConvoPane').isVisible();
    const convoList = await page.locator('#convoList').isVisible();
    const convoItems = await page.locator('#convoList .convo-item').count();
    const statusDots = await page.locator('.status-dot').count();
    const greenDots = await page.locator('.status-dot.online').count();
    const grayDots = await page.locator('.status-dot.offline').count();
    const chatHeaderName = await page.locator('#chatHeaderName').textContent().catch(() => 'N/A');
    const chatHeaderStatus = await page.locator('#chatHeaderStatus').textContent().catch(() => 'N/A');
    const convoListText = await page.locator('#convoList').innerText().catch(() => '');

    console.log('\n--- P2P CHAT REPORT ---');
    console.log('Conversation list pane visible:', convoPane);
    console.log('Conversation list (#convoList) visible:', convoList);
    console.log('Conversation items count:', convoItems);
    console.log('Status dots total:', statusDots);
    console.log('Green (online) dots:', greenDots);
    console.log('Gray (offline) dots:', grayDots);
    const onlineLabelCount = await page.locator('text=online').count();
    console.log('"Online" labels visible:', onlineLabelCount);
    console.log('Chat header name:', chatHeaderName);
    console.log('Chat header status:', chatHeaderStatus);
    console.log('Convo list content (first 500 chars):', convoListText.substring(0, 500));
  } finally {
    await browser.close();
  }
}

main().catch(console.error);
