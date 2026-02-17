#!/usr/bin/env node
/**
 * Login → My Profile → Scroll to Platform Configuration → Screenshot → Report
 */
import { chromium } from 'playwright';
import { mkdirSync } from 'fs';
import { join } from 'path';

const BASE = 'http://localhost:3000';
const OUT_DIR = join(process.cwd(), 'screenshots');

const CONFIG_FIELDS = [
  'cfgAdminPhone', 'cfgTwilioPhone', 'cfgGroqKey', 'cfgOpenaiKey', 'cfgAnthropicKey',
  'cfgGoogleKey', 'cfgOpenrouterKey', 'cfgTogetherKey', 'cfgDeepseekKey', 'cfgMistralKey',
  'cfgDefaultProvider', 'cfgDefaultKey', 'cfgKaggleUrl', 'cfgElevenLabsKey', 'cfgServerUrl'
];

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

    // 2. Click My Profile
    await page.click('.nav-item[data-s="profile"]');
    await page.waitForSelector('#p-profile', { state: 'visible', timeout: 5000 });
    await page.waitForTimeout(2000); // let profile + platform config load

    // 3. Scroll to Platform Configuration
    const panel = page.locator('#platformConfigPanel');
    const isVisible = await panel.isVisible();
    if (isVisible) {
      await panel.scrollIntoViewIfNeeded();
      await page.waitForTimeout(500);
    }

    // 4. Screenshot
    await page.screenshot({ path: join(OUT_DIR, 'platform-config.png'), fullPage: true });
    console.log('Screenshot saved: platform-config.png');

    // 5. Report
    console.log('\n--- PLATFORM CONFIGURATION REPORT ---');
    console.log('Platform Configuration panel visible:', isVisible);

    const fieldLabels = {
      cfgAdminPhone: 'Admin Phone (escalation)',
      cfgTwilioPhone: 'Twilio Phone Number',
      cfgGroqKey: 'Groq API Key',
      cfgOpenaiKey: 'OpenAI API Key',
      cfgAnthropicKey: 'Anthropic API Key',
      cfgGoogleKey: 'Google API Key',
      cfgOpenrouterKey: 'OpenRouter API Key',
      cfgTogetherKey: 'Together API Key',
      cfgDeepseekKey: 'DeepSeek API Key',
      cfgMistralKey: 'Mistral API Key',
      cfgDefaultProvider: 'Default LLM Provider',
      cfgDefaultKey: 'Default LLM Key',
      cfgKaggleUrl: 'Kaggle Ollama URL',
      cfgElevenLabsKey: 'ElevenLabs API Key',
      cfgServerUrl: 'Server URL',
    };

    const values = await page.evaluate((ids) => {
      const out = {};
      ids.forEach(id => {
        const el = document.getElementById(id);
        out[id] = el ? el.value : null;
      });
      return out;
    }, CONFIG_FIELDS);

    console.log('\nFields and values:');
    for (const id of CONFIG_FIELDS) {
      const val = values[id];
      const label = fieldLabels[id] || id;
      const display = val ? (val.length > 4 ? val.substring(0, 4) + '***' : val) : '(empty)';
      console.log(`  ${label}: ${display}`);
    }
  } finally {
    await browser.close();
  }
}

main().catch(console.error);
