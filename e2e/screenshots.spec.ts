import { createHash } from 'node:crypto';
import { mkdir } from 'node:fs/promises';
import { installMock } from './mock/mockYouTube';
import { cards, expectCount, lb, press, test, WL, type Mock } from './harness';
import type { BrowserContext, Page } from '@playwright/test';

// Store images go in store/screenshots; QA sizes go to LB_QA_DIR when it is set.
const STORE = 'store/screenshots';
const QA = process.env.LB_QA_DIR;

const CATEGORIES = [
  { id: 'c1', name: 'To study', color: '#0E8F80' },
  { id: 'c2', name: 'Weekend', color: '#8B5CF6' },
  { id: 'c3', name: 'Cooking', color: '#C2570C' },
  { id: 'c4', name: 'For work', color: '#2F7FE8' },
];
const NOTES = [
  'Resume from minute 12, clear walkthrough of the foundations.',
  'A friend recommended this. Watch before the trip.',
  'Needed for the Thursday presentation.',
];

async function seed(context: BrowserContext, mock: Mock) {
  const worker = context.serviceWorkers()[0] ?? await context.waitForEvent('serviceworker');
  const acct = createHash('sha256').update('test-datasync||').digest('hex').slice(0, 16);
  const videos: Record<string, unknown> = {};
  mock.videoIds().forEach((id: string, i: number) => {
    const categoryIds = CATEGORIES.filter((_, c) => (i + c) % (3 + c) === 0).map((c) => c.id);
    const note = i % 5 === 1 ? NOTES[i % NOTES.length]! : '';
    if (categoryIds.length || note) videos[id] = { categoryIds, note, updatedAt: 1 };
  });
  await worker.evaluate(([key, meta]) => chrome.storage.local.set({ [key as string]: meta }), [`lb:v1:${acct}:meta`, { categories: CATEGORIES, videos }]);
}

async function ready(page: Page, width: number, height: number, n = 620) {
  await page.setViewportSize({ width, height });
  await page.goto(WL);
  await expectCount(page, n);
  await page.waitForTimeout(500); // thumbnails
}

const shot = async (page: Page, dir: string, name: string) => page.screenshot({ path: `${dir}/${name}.png` });

for (const dark of [true, false]) {
  const theme = dark ? 'dark' : 'light';
  test(`store and QA set, ${theme}`, async ({ context, page }) => {
    test.setTimeout(120_000);
    await mkdir(STORE, { recursive: true });
    if (QA) await mkdir(QA, { recursive: true });
    const mock = await installMock(context, { totalVideos: 620, dark });
    await seed(context, mock);
    await ready(page, 1280, 800);
    await shot(page, STORE, `01-overview-${theme}`);

    const box = (await lb(page).locator('.hist-track').boundingBox())!;
    await page.mouse.move(box.x + box.width * 0.36, box.y + 30);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width * 0.62, box.y + 30, { steps: 5 });
    await page.mouse.up();
    await page.mouse.move(10, 400);
    await lb(page).locator('.sidebar .row', { hasText: 'Not started' }).click();
    await page.waitForTimeout(150);
    await shot(page, STORE, `02-histogram-${theme}`);
    await lb(page).locator('.listbar .link').click();

    await press(page, 'g');
    await lb(page).locator('.searchbox input').fill('resume');
    await page.waitForTimeout(250);
    await shot(page, STORE, `03-notes-search-${theme}`);
    await press(page, 'Escape');
    await lb(page).locator('.sidebar .row', { hasText: 'Finished' }).click();
    await lb(page).locator('.select-all input').check();
    await page.waitForTimeout(250);
    await shot(page, STORE, `04-bulk-remove-${theme}`);
    await press(page, 'Escape');
    await lb(page).locator('.sidebar .row', { hasText: 'All' }).click();
    await press(page, 'g');

    await lb(page).locator('.chip', { hasText: '1h' }).click();
    await page.waitForTimeout(250);
    await shot(page, STORE, `05-time-budget-${theme}`);
    await press(page, 'Escape');
    await cards(page).first().hover();
    await cards(page).first().getByRole('button', { name: 'Categories' }).click();
    await page.waitForTimeout(150);
    await shot(page, STORE, `06-categories-${theme}`);
    await press(page, 'Escape');

    if (!QA) return;
    await page.setViewportSize({ width: 1500, height: 812 });
    await page.mouse.move(10, 400);
    await page.waitForTimeout(300);
    await shot(page, QA, `wide-${theme}`);
    await press(page, 'g');
    await page.waitForTimeout(200);
    await shot(page, QA, `wide-list-${theme}`);
    await press(page, 'g');
    await page.setViewportSize({ width: 800, height: 900 });
    await page.waitForTimeout(300);
    await shot(page, QA, `tablet-${theme}`);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForTimeout(300);
    await shot(page, QA, `phone-${theme}`);
    await lb(page).locator('.drawer-btn').click();
    await page.waitForTimeout(250);
    await shot(page, QA, `phone-drawer-${theme}`);
    await press(page, 'Escape');
    await lb(page).locator('.check').first().click({ force: true });
    await page.waitForTimeout(250);
    await shot(page, QA, `phone-dock-${theme}`);
    await press(page, 'Escape');
    await lb(page).locator('.select-all input').check();
    await lb(page).locator('[data-action=remove]').click();
    await page.waitForTimeout(250);
    await shot(page, QA, `phone-confirm-${theme}`);
  });
}
