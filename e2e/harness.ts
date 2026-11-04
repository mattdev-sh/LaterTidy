import { test as base, chromium, expect, type BrowserContext, type Locator, type Page } from '@playwright/test';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { installMock } from './mock/mockYouTube';

/** Deadline multiplier; see playwright.config.ts. */
export const SCALE = Number(process.env.LB_TIME_SCALE ?? 1);

export const WL = 'https://www.youtube.com/playlist?list=WL';

interface Fixtures { context: BrowserContext; page: Page }

export const test = base.extend<Fixtures>({
  context: async ({}, use) => {
    const dir = await mkdtemp(join(tmpdir(), 'latertidy-'));
    const dist = resolve('dist');
    const context = await chromium.launchPersistentContext(dir, {
      channel: 'chromium',
      headless: true,
      viewport: { width: 1280, height: 800 },
      args: [`--disable-extensions-except=${dist}`, `--load-extension=${dist}`],
    });
    try {
      // Later mock routes take priority. A missing route must never hit a real account or site.
      await context.route(/^https?:\/\//, (route) => route.abort());
      await use(context);
    } finally {
      await context.close();
      await rm(dir, { recursive: true, force: true });
    }
  },
  page: async ({ context }, use) => {
    await use(context.pages()[0] ?? await context.newPage());
  },
});

export { expect };

export type Mock = Awaited<ReturnType<typeof installMock>>;

/** Locators pierce the open shadow root automatically. */
export const lb = (page: Page) => page.locator('#latertidy-root');
export const overlay = (page: Page): Locator => lb(page).locator('.overlay');

export async function openLoaded(page: Page, expected: number, url = WL) {
  await page.goto(url);
  await expect(overlay(page)).toBeVisible();
  await expectCount(page, expected);
}

/** Header count, then no refresh in progress. */
export async function expectCount(page: Page, n: number) {
  await expect(lb(page).locator('.count')).toHaveText(new RegExp(`^${n.toLocaleString('en-US')} videos?$`));
  await expect(lb(page).locator('.sync')).toHaveCount(0);
}

export const cards = (page: Page) => lb(page).locator('[role=listitem]');
export const press = (page: Page, key: string) => page.keyboard.press(key);
