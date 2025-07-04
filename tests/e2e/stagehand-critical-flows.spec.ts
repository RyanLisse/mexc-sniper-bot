import { Stagehand } from '@browserbasehq/stagehand';
import { expect, test } from '@playwright/test';
import { z } from 'zod';
import StagehandConfig from '../../stagehand.config.unified';

const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:3008';
const EMAIL = process.env.AUTH_EMAIL || 'ryan@ryanlisse.com';
const PASSWORD = process.env.AUTH_PASSWORD || 'Testing2025!';

test.describe('Critical flow smoke test (Stagehand)', () => {
  let stagehand: Stagehand;

  test.beforeAll(async () => {
    stagehand = new Stagehand(StagehandConfig);
    await stagehand.init();
  });

  test.afterAll(async () => {
    if (stagehand) await stagehand.close();
  });

  test('login and verify dashboard access', async () => {
    const page = stagehand.page;
    await page.goto(`${BASE_URL}`);
    await page.act('Click the Sign In button');
    await page.waitForURL('**/auth');

    await page.act(`Fill in the email field with "${EMAIL}"`);
    await page.act(`Fill in the password field with "${PASSWORD}"`);
    await page.act('Click the submit button to sign in');

    await page.waitForURL('**/dashboard');
    const result = await page.extract({
      instruction: 'Confirm user landed on dashboard',
      schema: z.object({ dashboard: z.boolean() })
    });
    expect(result.dashboard).toBe(true);
  });
});
