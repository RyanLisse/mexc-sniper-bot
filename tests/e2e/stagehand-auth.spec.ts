import { test, expect } from '@playwright/test';
import { Stagehand } from '@browserbasehq/stagehand';
import StagehandConfig from '../../stagehand.config.unified';

const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:3008';
const TEST_EMAIL = 'stagehand@test.example.com';
const TEST_PASSWORD = 'Testing2025!';

let stagehand: Stagehand;

test.beforeAll(async () => {
  stagehand = new Stagehand(StagehandConfig as any);
  await stagehand.init();
});

test.afterAll(async () => {
  try {
    await fetch(
      `${BASE_URL}/api/test-users?email=${encodeURIComponent(TEST_EMAIL)}`,
      { method: 'DELETE' }
    );
  } catch (err) {
    console.warn('Failed to cleanup test user', err);
  }
  await stagehand?.close();
});

test('stagehand can sign in', async () => {
  const page = await stagehand.getPage();
  await page.goto(`${BASE_URL}/auth`);
  await page.act(`Fill the email field with ${TEST_EMAIL}`);
  await page.act(`Fill the password field with ${TEST_PASSWORD}`);
  await page.act('Click the Sign In button');
  await page.waitForURL(/.*\/dashboard/);
  expect(page.url()).toContain('/dashboard');
});
