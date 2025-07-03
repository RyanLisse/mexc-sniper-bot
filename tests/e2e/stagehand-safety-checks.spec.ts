import { test, expect } from '@playwright/test';
import { Stagehand } from '@browserbasehq/stagehand';
import StagehandConfig from '../../stagehand.config.unified';
import { withStagehandTimeout } from '../setup/playwright-timeout-config';

const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:3008';

test.describe('Stagehand Safety Checks', () => {
  let stagehand: Stagehand;

  test.beforeAll(async () => {
    stagehand = new Stagehand(StagehandConfig);
    await stagehand.init();
  });

  test.afterAll(async () => {
    await stagehand?.close();
  });

  test('fetches safety constraint list', async () => {
    const response = await withStagehandTimeout(() =>
      stagehand.page.request.get(`${BASE_URL}/api/tuning/safety-constraints`)
    );

    expect(response.ok()).toBeTruthy();
    const data = await response.json();
    expect(Array.isArray(data.constraints)).toBe(true);
  });
});
