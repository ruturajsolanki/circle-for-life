#!/usr/bin/env node
/**
 * Login flow test: Navigate, screenshot login, fill form, click Sign In, wait 3s, screenshot result
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
    // 1. Navigate to login page
    await page.goto(BASE, { waitUntil: 'networkidle' });
    await page.waitForSelector('#loginForm', { timeout: 5000 });

    // 2. Screenshot of login page
    await page.screenshot({ path: join(OUT_DIR, 'login-page.png'), fullPage: true });
    console.log('Screenshot 1: login-page.png');

    // 3. Click email, type
    await page.click('#loginEmail');
    await page.fill('#loginEmail', 'admin@circleforlife.app');

    // 4. Click password, type
    await page.click('#loginPass');
    await page.fill('#loginPass', 'admin123456');

    // 5. Click Sign In
    await page.click('#loginBtn');

    // 6. Wait 5 seconds
    await page.waitForTimeout(5000);

    // 7. Screenshot of result
    await page.screenshot({ path: join(OUT_DIR, 'after-login.png'), fullPage: true });
    console.log('Screenshot 2: after-login.png');

    // Report
    const dashVisible = await page.locator('#dashApp.show').isVisible();
    const authVisible = await page.locator('#authPage').isVisible();
    const alertVisible = await page.locator('#loginAlert.show').isVisible();
    const alertText = alertVisible ? await page.locator('#loginAlert').textContent() : null;
    const btnText = await page.locator('#loginBtn').textContent();

    console.log('\n--- REPORT ---');
    console.log('Dashboard visible:', dashVisible);
    console.log('Auth page still visible:', authVisible);
    console.log('Sign In button text:', btnText);
    console.log('Error alert visible:', alertVisible);
    if (alertText) console.log('Error message:', alertText.trim());
  } finally {
    await browser.close();
  }
}

main().catch(console.error);
