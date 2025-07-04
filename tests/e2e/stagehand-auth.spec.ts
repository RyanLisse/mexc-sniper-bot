import { test, expect } from '@playwright/test';
import { Stagehand } from '@browserbasehq/stagehand';
import StagehandConfig from '../../stagehand.config.unified';

const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:3008';
const TEST_EMAIL = process.env.TEST_USER_EMAIL || process.env.AUTH_EMAIL || 'ryan@ryanlisse.com';
const TEST_PASSWORD = process.env.TEST_USER_PASSWORD || process.env.AUTH_PASSWORD || 'Testing2025!';

let stagehand: Stagehand;

test.beforeAll(async () => {
  stagehand = new Stagehand(StagehandConfig as any);
  await stagehand.init();
});

test.afterAll(async () => {
  await stagehand?.close();
});

test('stagehand can sign in', async () => {
  const page = stagehand.page;
  await page.goto(`${BASE_URL}/auth`);
  await page.act(`Fill the email field with ${TEST_EMAIL}`);
  await page.act(`Fill the password field with ${TEST_PASSWORD}`);
  await page.act('Click the submit button to sign in');
  await page.waitForURL(/.*\/dashboard/);
  expect(page.url()).toContain('/dashboard');
});
