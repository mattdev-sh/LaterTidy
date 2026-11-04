import { installMock } from './mock/mockYouTube';
import { cards, expect, expectCount, lb, openLoaded, overlay, SCALE, test } from './harness';

test('real flow: open, load, search, category, note, remove, undo, commit', async ({ context, page }) => {
  const mock = await installMock(context, { totalVideos: 620, dark: true });
  await openLoaded(page, 620);
  expect(mock.reads.filter((r) => r.path.includes('browse')).length).toBe(7);

  const first = mock.videos()[0] as any;
  const title = first.title.runs[0].text;
  await lb(page).locator('.searchbox input').fill(title);
  await expect(cards(page).first()).toContainText(title);
  await page.keyboard.press('Escape');
  await expectCount(page, 620);

  // bulk category
  await lb(page).locator('.check').nth(0).click({ force: true });
  await lb(page).locator('.check').nth(1).click({ force: true, modifiers: ['Shift'] });
  await lb(page).locator('.dock').getByRole('button', { name: 'Categories' }).click();
  await lb(page).getByPlaceholder('Find or create').fill('To review');
  await page.keyboard.press('Enter');
  await page.keyboard.press('Escape');
  await expect(lb(page).locator('.sidebar .row', { hasText: 'To review' })).toContainText('2');

  // remove then undo
  await lb(page).locator('[data-action=remove]').click();
  await expectCount(page, 618);
  await lb(page).locator('.toast-action').click();
  await expectCount(page, 620);
  expect(mock.writes.length).toBe(0);

  // note survives reload, removal commits after the undo window
  await cards(page).first().hover();
  await cards(page).first().getByRole('button', { name: 'Note' }).click();
  await lb(page).locator('textarea').fill('Test line');
  await page.keyboard.press('Control+Enter');
  await expect(lb(page).locator('textarea')).toHaveCount(0);
  await page.waitForTimeout(400);
  await page.reload();
  await expect(overlay(page)).toBeVisible();
  await expectCount(page, 620);
  await expect(cards(page).first().locator('.note-mark')).toBeVisible();

  await lb(page).locator('.select-all input').check();
  await lb(page).locator('[data-action=remove]').click();
  await lb(page).locator('[data-action=remove]').click();
  await expect.poll(() => mock.videos().length, { timeout: 30_000 * SCALE }).toBe(0);
  expect(mock.writes.length).toBe(25);
});
