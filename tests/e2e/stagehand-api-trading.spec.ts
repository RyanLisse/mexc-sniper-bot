import { test, expect } from '@playwright/test';
import { Stagehand } from '@browserbasehq/stagehand';
import StagehandConfig from '../../stagehand.config.unified';
import { withStagehandTimeout } from '../setup/playwright-timeout-config';

const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:3008';

test.describe('Stagehand Trading API', () => {
  let stagehand: Stagehand;

  test.beforeAll(async () => {
    stagehand = new Stagehand(StagehandConfig);
    await stagehand.init();
  });

  test.afterAll(async () => {
    await stagehand?.close();
  });

  test('rejects trade without credentials', async () => {
    const response = await withStagehandTimeout(() =>
      stagehand.page.request.post(`${BASE_URL}/api/mexc/trade`, {
        data: {
          symbol: 'BTCUSDT',
          side: 'BUY',
          type: 'MARKET',
          quantity: '0.1',
          userId: 'test-user',
        },
      })
    );

    expect(response.status()).toBeGreaterThanOrEqual(400);
  });
});
