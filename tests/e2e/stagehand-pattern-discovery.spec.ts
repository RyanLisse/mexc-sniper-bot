import { test, expect } from '@playwright/test';
import { Stagehand } from '@browserbasehq/stagehand';
import StagehandConfig from '../../stagehand.config.unified';
import { z } from 'zod';
import { withStagehandTimeout } from '../setup/playwright-timeout-config';

const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:3008';

// Basic Stagehand pattern discovery test
// Follows the initialization/cleanup pattern from stagehand-auth-complete spec

test.describe('Stagehand Pattern Discovery', () => {
  let stagehand: Stagehand;

  test.beforeAll(async () => {
    stagehand = new Stagehand(StagehandConfig);
    await stagehand.init();
  });

  test.afterAll(async () => {
    await stagehand?.close();
  });

  test('analyzes patterns on the dashboard', async () => {
    const page = stagehand.page;

    await withStagehandTimeout(() => page.goto(`${BASE_URL}/dashboard`));

    await withStagehandTimeout(() =>
      stagehand.act('Open the Pattern Detection tab')
    );

    const result = await withStagehandTimeout(() =>
      stagehand.extract({
        instruction: 'List any detected trading patterns',
        schema: z.object({
          patterns: z.array(z.string()).optional(),
        }),
      })
    );

    expect(result).toBeDefined();
  });
});
