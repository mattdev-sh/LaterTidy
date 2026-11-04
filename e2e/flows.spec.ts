import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { installMock } from './mock/mockYouTube';
import { makeVideos } from './mock/fixtures';
import { cards, expect, expectCount, lb, openLoaded, overlay, press, SCALE, test, WL } from './harness';

test.describe('opening', () => {
  test('auto-opens, loads all pages, sets auth, Esc reveals the page', async ({ context, page }) => {
    const mock = await installMock(context, { totalVideos: 620, dark: true });
    await openLoaded(page, 620);
    const body = mock.reads.find((r) => r.path.includes('browse'))!.body as any;
    expect(body.browseId).toBe('VLWL');
    expect(body.params).toBe('wgYCCAA%3D');
    expect(body.context).toBeTruthy();
    await page.keyboard.press('Escape');
    await expect(overlay(page)).toBeHidden();
    await expect(page.locator('html')).not.toHaveCSS('overflow', 'hidden');
  });

  test('cookie fallback to __Secure-3PAPISID reaches the API', async ({ context, page }) => {
    const mock = await installMock(context, { totalVideos: 30, cookies: 'secure3p' });
    await openLoaded(page, 30);
    await cards(page).first().hover();
    await cards(page).first().getByRole('button', { name: 'Remove' }).click();
    await lb(page).locator('.toast').waitFor();
    await expect.poll(() => mock.writeLog.length, { timeout: 12_000 * SCALE }).toBe(1);
    expect(mock.writeLog[0]!.authorization).toMatch(/^SAPISIDHASH \d+_[0-9a-f]{40}$/);
    expect(mock.videos()).toHaveLength(29);
  });

  test('auto-open off keeps the classic page; masthead button opens', async ({ context, page }) => {
    await installMock(context, { totalVideos: 30 });
    await openLoaded(page, 30);
    await lb(page).getByRole('button', { name: 'Settings' }).click();
    await lb(page).getByLabel('Open on the Watch Later page').uncheck();
    await press(page, 'Escape');
    await page.waitForTimeout(100);
    await page.reload();
    await page.locator('#latertidy-masthead-button').waitFor();
    await expect(overlay(page)).toHaveCount(0);
    await page.locator('#latertidy-masthead-button').click();
    await expect(overlay(page)).toBeVisible();
  });

  test('masthead button comes back after YouTube rebuilds the masthead', async ({ context, page }) => {
    await installMock(context, { totalVideos: 10 });
    await page.goto('https://www.youtube.com/');
    await page.locator('#latertidy-masthead-button').waitFor();
    await page.evaluate(() => document.querySelector('#latertidy-masthead-button')!.remove());
    await page.locator('#latertidy-masthead-button').waitFor({ timeout: 4000 * SCALE });
    await expect(page.locator('ytd-masthead #end #buttons #latertidy-masthead-button svg')).toHaveCount(1);
  });

  test('#latertidy forces open on another page and strips the hash', async ({ context, page }) => {
    await installMock(context, { totalVideos: 10 });
    await page.goto('https://www.youtube.com/feed/history#latertidy');
    await expect(overlay(page)).toBeVisible();
    await expect.poll(() => page.url()).toBe('https://www.youtube.com/feed/history');
  });

  test('toolbar click toggles from the service worker', async ({ context, page }) => {
    await installMock(context, { totalVideos: 10 });
    await page.goto('https://www.youtube.com/');
    await page.locator('#latertidy-masthead-button').waitFor();
    const worker = context.serviceWorkers()[0] ?? await context.waitForEvent('serviceworker');
    await worker.evaluate(async () => {
      const [tab] = await chrome.tabs.query({ url: 'https://www.youtube.com/*' });
      await chrome.tabs.sendMessage(tab!.id!, { type: 'toggle' });
    });
    await expect(overlay(page)).toBeVisible();
  });

  test('logged out shows sign-in and no list', async ({ context, page }) => {
    const mock = await installMock(context, { loggedIn: false });
    await page.goto(WL);
    await expect(lb(page).getByRole('heading', { name: 'Sign in to see your Watch Later' })).toBeVisible();
    await expect(lb(page).getByRole('link', { name: 'Sign in' })).toBeVisible();
    expect(mock.reads.length).toBe(0);
  });

  test('english UI follows hl', async ({ context, page }) => {
    await installMock(context, { totalVideos: 10, hl: 'en' });
    await page.goto(WL);
    await expect(lb(page).getByRole('button', { name: 'Classic view' })).toBeVisible();
    await expect(lb(page).locator('.count')).toHaveText('10 videos');
  });

  test('empty list', async ({ context, page }) => {
    await installMock(context, { videos: [] });
    await page.goto(WL);
    await expect(lb(page).getByRole('heading', { name: 'Watch Later is empty' })).toBeVisible();
  });

  test('load failure explains itself, offers Retry and Classic view', async ({ context, page }) => {
    await installMock(context, { totalVideos: 20 });
    await context.route('**/youtubei/v1/browse?*', (r) => r.fulfill({ status: 200, body: '{"nothing":true}' }), { times: 1 });
    await page.goto(WL);
    await expect(lb(page).getByRole('heading', { name: 'Could not load the list' })).toBeVisible();
    await expect(lb(page).locator('.message').getByRole('button', { name: 'Classic view' })).toBeVisible();
    await lb(page).getByRole('button', { name: 'Retry' }).click();
    await expectCount(page, 20);
  });

  test('second visit opens instantly from cache, then refreshes', async ({ context, page }) => {
    const mock = await installMock(context, { totalVideos: 220, latencyMs: 400 });
    await openLoaded(page, 220);
    await page.waitForTimeout(150);
    await page.reload();
    await expect(cards(page).first()).toBeVisible({ timeout: 1800 * SCALE });
    await expect(lb(page).locator('.sync')).toBeVisible();
    await expect(lb(page).locator('.count')).toHaveText('220 videos');
    await expectCount(page, 220);
    void mock;
  });
});

test.describe('finding', () => {
  test('search highlights and clear filters recovers from no matches', async ({ context, page }) => {
    const videos = makeVideos(40);
    (videos[3] as any).title.runs[0].text = 'Perché il caffè è amaro';
    await installMock(context, { videos });
    await openLoaded(page, 40);
    await lb(page).locator('.searchbox input').fill('caffe AMARO');
    await expectCount(page, 1);
    await expect(cards(page).first().locator('mark').first()).toHaveText('caffè');
    await lb(page).locator('.searchbox input').fill('zzzzqq');
    await lb(page).getByRole('heading', { name: 'No videos match' }).waitFor();
    await lb(page).locator('.message').getByRole('button', { name: 'Clear filters' }).click();
    await expectCount(page, 40);
  });

  test('histogram brush filters by drag and by keyboard', async ({ context, page }) => {
    await installMock(context, { totalVideos: 200 });
    await openLoaded(page, 200);
    const track = lb(page).locator('.hist-track');
    const box = (await track.boundingBox())!;
    await page.mouse.move(box.x + box.width * 0.4, box.y + 30);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width * 0.6, box.y + 30, { steps: 6 });
    await page.mouse.up();
    const n = Number(await lb(page).locator('.count').innerText().then((s) => s.split(' ')[0]));
    expect(n).toBeGreaterThan(0);
    expect(n).toBeLessThan(200);
    await expect(lb(page).locator('.bar:not(.on)').first()).toBeVisible();
    const minHandle = lb(page).getByRole('slider', { name: 'Shortest length' });
    const before = await minHandle.getAttribute('aria-valuenow');
    await minHandle.focus();
    await press(page, 'ArrowRight');
    await expect(minHandle).toHaveAttribute('aria-valuenow', String(Number(before) + 1));
    await lb(page).getByRole('button', { name: 'Clear length filter' }).click();
    await expectCount(page, 200);
  });

  test('sort is view-only and never writes', async ({ context, page }) => {
    const mock = await installMock(context, { totalVideos: 60 });
    await openLoaded(page, 60);
    await lb(page).locator('.sort-btn').click();
    await lb(page).getByRole('menuitemradio', { name: 'Shortest' }).click();
    await expect(lb(page).locator('.sort-btn')).toContainText('Shortest');
    expect(mock.writes.length).toBe(0);
  });

  test('status filter suggests Remove all with two-step at 50+', async ({ context, page }) => {
    const mock = await installMock(context, { totalVideos: 620 });
    await openLoaded(page, 620);
    await lb(page).locator('.sidebar .row', { hasText: 'Finished' }).click();
    const n = Number((await lb(page).locator('.count').innerText()).split(' ')[0]);
    const btn = lb(page).locator('[data-action=remove-all]');
    await expect(btn).toHaveText(`Remove all ${n}`);
    await btn.click();
    await lb(page).locator('.toast', { hasText: `${n} removed` }).waitFor();
    await lb(page).locator('.toast-action').click();
    await expectCount(page, n);
    expect(mock.writes.length).toBe(0);
  });
});

/** Selects the first n videos: cursor on the first, then extend by keyboard-free shift-click through the store's order. */
async function selectFirst(page: Parameters<typeof lb>[0], n: number) {
  await lb(page).locator('.check').first().click({ force: true });
  await lb(page).locator('.scroller').evaluate((el, top) => { el.scrollTop = top; }, Math.floor((n - 1) / 3) * 288);
  await lb(page).locator(`[aria-posinset="${n}"] .check`).click({ force: true, modifiers: ['Shift'] });
}

test.describe('removing', () => {
  test('300 removed: confirm in place, 12 chunks of 25, progress shown', async ({ context, page }) => {
    const mock = await installMock(context, { totalVideos: 620, latencyMs: 40 });
    await openLoaded(page, 620);
    await selectFirst(page, 300);
    await expect(lb(page).locator('.dock')).toContainText('300 selected');
    const remove = lb(page).locator('[data-action=remove]');
    await remove.click();
    await expect(remove).toHaveText('Confirm: remove 300');
    await page.waitForTimeout(100);
    expect(mock.writes.length).toBe(0);
    await remove.click();
    await lb(page).locator('.toast', { hasText: '300 removed' }).waitFor();
    await expectCount(page, 320);
    await page.waitForTimeout(500);
    expect(mock.writes.length).toBe(0);
    await lb(page).locator('[data-toast=progress]').waitFor({ timeout: 10_000 * SCALE });
    await expect(lb(page).locator('[data-toast=progress]')).toContainText(/Removing \d+ of 300/);
    await expect.poll(() => mock.videos().length, { timeout: 20_000 * SCALE }).toBe(320);
    expect(mock.writes.map((w: any) => w.actions.length)).toEqual(new Array(12).fill(25));
    expect(mock.writes.every((w: any) => w.playlistId === 'WL' && w.actions.every((a: any) => a.action === 'ACTION_REMOVE_VIDEO' && a.setVideoId))).toBe(true);
    await expect(lb(page).locator('[data-toast=progress]')).toHaveCount(0);
    await expectCount(page, 320);
  });

  test('undo restores position and sends nothing', async ({ context, page }) => {
    const mock = await installMock(context, { totalVideos: 30 });
    await openLoaded(page, 30);
    const firstId = await cards(page).first().getAttribute('data-id');
    await cards(page).first().hover();
    await cards(page).first().getByRole('button', { name: 'Remove' }).click();
    await expectCount(page, 29);
    await lb(page).locator('.toast-action').click();
    await expectCount(page, 30);
    await expect(cards(page).first()).toHaveAttribute('data-id', firstId!);
    await page.waitForTimeout(8300);
    expect(mock.writes.length).toBe(0);
  });

  test('partial failure restores only the failed chunk and offers Retry', async ({ context, page }) => {
    const mock = await installMock(context, { totalVideos: 200 });
    await openLoaded(page, 200);
    const victim = (mock.videos()[30] as any).setVideoId;
    mock.failNextWrites((b: any) => b.actions?.some((a: any) => a.setVideoId === victim) ?? false, { refuse: true });
    await selectFirst(page, 60);
    await lb(page).locator('[data-action=remove]').click();
    await lb(page).locator('[data-action=remove]').click();
    await expectCount(page, 140);
    await lb(page).locator('.toast.error').waitFor({ timeout: 15_000 * SCALE });
    await expect(lb(page).locator('.toast.error')).toContainText('25 not removed');
    await expectCount(page, 165);
    expect(mock.videos().length).toBe(165);
    mock.clearWriteFailures();
    await lb(page).locator('.toast.error .toast-action').click();
    await expect.poll(() => mock.videos().length, { timeout: 8000 * SCALE }).toBe(140);
    await expectCount(page, 140);
  });

  // A synthetic pagehide on a live page: Playwright can't observe requests sent during real
  // teardown, so this proves the flush and its payload, not that Chromium delivers it mid-unload.
  test('pagehide commits pending removals at once, without waiting for the undo window', async ({ context, page }) => {
    const mock = await installMock(context, { totalVideos: 30 });
    await openLoaded(page, 30);
    await cards(page).first().hover();
    await cards(page).first().getByRole('button', { name: 'Remove' }).click();
    await expectCount(page, 29);
    await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent('pagehide')));
    await expect.poll(() => mock.videos().length, { timeout: 2000 * SCALE }).toBe(29);
    expect((mock.writes[0] as any).actions).toHaveLength(1);
  });
});

test.describe('playlists, queue, reorder', () => {
  test('move hidden when canReorder is false, shown and sent when true', async ({ context, page }) => {
    const mock = await installMock(context, { totalVideos: 20, canReorder: false });
    await openLoaded(page, 20);
    await lb(page).locator('.check').first().click({ force: true });
    await expect(lb(page).locator('.dock')).toBeVisible();
    await expect(lb(page).getByRole('button', { name: 'Move to top' })).toHaveCount(0);
    await expect(lb(page).getByRole('button', { name: 'Move to bottom' })).toHaveCount(0);
    expect(mock.writes.length).toBe(0);
  });

  test('move to bottom when reorder is allowed', async ({ context, page }) => {
    const mock = await installMock(context, { totalVideos: 20, canReorder: true });
    await openLoaded(page, 20);
    const id = await cards(page).first().getAttribute('data-id');
    await lb(page).locator('.check').first().click({ force: true });
    await lb(page).getByRole('button', { name: 'Move to bottom' }).click();
    await expect.poll(() => mock.writes.length).toBe(1);
    expect((mock.writes[0] as any).actions[0].action).toBe('ACTION_MOVE_VIDEO_BEFORE');
    expect(mock.videoIds().at(-1)).toBe(id);
    await expect.poll(() => cards(page).first().getAttribute('data-id')).not.toBe(id);
  });

  test('add to playlist sends the payload; move option also removes', async ({ context, page }) => {
    const mock = await installMock(context, { totalVideos: 30 });
    await openLoaded(page, 30);
    const target = mock.playlists[0]!;
    await selectFirst(page, 2);
    await lb(page).locator('.dock').getByRole('button', { name: 'Add to playlist' }).click();
    await lb(page).locator('.popover .playlist', { hasText: target.title }).click();
    await lb(page).locator('.toast', { hasText: `2 added to ${target.title}` }).waitFor();
    const w = mock.writes[0] as any;
    expect(w.playlistId).toBe(target.playlistId);
    expect(w.actions.map((a: any) => a.action)).toEqual(['ACTION_ADD_VIDEO', 'ACTION_ADD_VIDEO']);
    expect(mock.playlistItems(target.playlistId)).toHaveLength(2);

    await lb(page).locator('.dock').getByRole('button', { name: 'Add to playlist' }).click();
    await lb(page).getByLabel('Remove from Watch Later').check();
    await lb(page).locator('.popover .playlist').nth(1).click();
    await lb(page).locator('.toast', { hasText: '2 removed' }).waitFor();
    await expectCount(page, 28);
  });

  test('dock Riproduci queues the selection', async ({ context, page }) => {
    const mock = await installMock(context, { totalVideos: 30 });
    await openLoaded(page, 30);
    await selectFirst(page, 3);
    const ids = mock.videoIds().slice(0, 3);
    await lb(page).locator('[data-action=play]').click();
    await page.waitForURL('**/watch?**');
    expect(mock.watchVideos.at(-1)).toEqual(ids);
  });

  test('budget picks within the limit, rerolls, and plays', async ({ context, page }) => {
    const mock = await installMock(context, { totalVideos: 200 });
    await openLoaded(page, 200);
    await lb(page).locator('.chip', { hasText: '1h' }).click();
    const list = lb(page).locator('.budget-list li');
    await expect(list.first()).toBeVisible();
    const first = await list.allInnerTexts();
    await lb(page).getByRole('button', { name: 'Another pick' }).click();
    await expect.poll(() => list.allInnerTexts()).not.toEqual(first);
    await lb(page).locator('[data-action=budget-play]').click();
    await page.waitForURL('**/watch?**');
    expect(mock.watchVideos.length).toBe(1);
    expect(mock.watchVideos[0]!.length).toBeGreaterThan(0);
    expect(mock.watchVideos[0]!.length).toBeLessThanOrEqual(50);
  });
});

test.describe('keyboard', () => {
  test('YouTube never sees keys; typing in fields works; Esc walks back', async ({ context, page }) => {
    await installMock(context, { totalVideos: 40 });
    await openLoaded(page, 40);
    await press(page, 'j');
    await press(page, 'j');
    await press(page, 'k');
    await expect(lb(page).locator('.cursor')).toHaveAttribute('aria-posinset', '1');
    await press(page, 'x');
    await expect(lb(page).locator('.dock')).toBeVisible();
    await press(page, '/');
    await page.keyboard.type('fk jm', { delay: 5 });
    await expect(lb(page).locator('.searchbox input')).toHaveValue('fk jm');
    expect(await page.evaluate(() => (window as any).__pageKeys)).toEqual([]);

    await press(page, 'Escape'); // search
    await expect(lb(page).locator('.searchbox input')).toHaveValue('');
    await expect(lb(page).locator('.dock')).toBeVisible();
    await press(page, 'Escape'); // selection
    await expect(lb(page).locator('.dock')).toHaveCount(0);
    await press(page, '?');
    await expect(lb(page).getByRole('heading', { name: 'x' })).toHaveCount(0);
    await lb(page).locator('.keys').waitFor();
    await press(page, 'Escape'); // popover
    await expect(lb(page).locator('.keys')).toHaveCount(0);
    await expect(overlay(page)).toBeVisible();
    await press(page, 'Escape'); // close
    await expect(overlay(page)).toBeHidden();
    await press(page, 'k');
    expect(await page.evaluate(() => (window as any).__pageKeys)).toEqual(['k']);
  });

  test('g, u, e, c and n work', async ({ context, page }) => {
    const mock = await installMock(context, { totalVideos: 40 });
    await openLoaded(page, 40);
    await press(page, 'g');
    await lb(page).locator('.line').first().waitFor();
    await press(page, 'j');
    await press(page, 'e');
    await expectCount(page, 39);
    await press(page, 'u');
    await expectCount(page, 40);
    await press(page, 'c');
    await page.keyboard.type('Rapida');
    await press(page, 'Enter');
    await press(page, 'Escape');
    await expect(lb(page).locator('.sidebar .row', { hasText: 'Rapida' })).toContainText('1');
    await press(page, 'n');
    const ta = lb(page).locator('textarea');
    await page.keyboard.type('jkx typed nella nota');
    await expect(ta).toHaveValue('jkx typed nella nota');
    await press(page, 'Escape');
    await expect(ta).toHaveCount(0);
    await expect(lb(page).locator('.note-line').first()).toContainText('jkx typed');
    await press(page, 'n');
    await expect(ta).toHaveValue('jkx typed nella nota');
    await ta.fill('');
    await press(page, 'Control+Enter');
    await expect(lb(page).locator('.note-line')).toHaveCount(0);
    expect(mock.writes.length).toBe(0);
  });
});

test.describe('categories and notes', () => {
  test('bulk tri-state, filter, rename, delete with undo', async ({ context, page }) => {
    const mock = await installMock(context, { totalVideos: 30 });
    await openLoaded(page, 30);
    const open = () => lb(page).locator('.dock').getByRole('button', { name: 'Categories' }).click();
    await lb(page).locator('.check').first().click({ force: true });
    await open();
    await lb(page).getByPlaceholder('Find or create').fill('Studio');
    await press(page, 'Enter');
    await press(page, 'Escape');
    await lb(page).locator('.check').nth(1).click({ force: true });
    await open();
    const box = lb(page).getByRole('checkbox', { name: 'Studio' });
    await expect(box).toHaveAttribute('aria-checked', 'mixed');
    await box.click();
    await expect(box).toHaveAttribute('aria-checked', 'true');
    await press(page, 'Escape');
    const row = lb(page).locator('.sidebar .row', { hasText: 'Studio' });
    await expect(row).toContainText('2');
    await expect(cards(page).first().locator('.dots')).toHaveAttribute('aria-label', 'Category: Studio');

    await press(page, 'Escape'); // clear selection
    await row.click();
    await expectCount(page, 2);
    await lb(page).locator('.sidebar .row', { hasText: 'No category' }).click();
    await expectCount(page, 30);
    await lb(page).locator('.sidebar .row', { hasText: 'Studio' }).click();
    await expectCount(page, 28);
    await lb(page).locator('.sidebar .row', { hasText: 'No category' }).click();

    await lb(page).locator('.row-wrap').hover();
    await lb(page).getByRole('button', { name: 'Edit Studio' }).click();
    await lb(page).locator('[data-rename]').fill('Work');
    await press(page, 'Enter');
    const renamed = lb(page).locator('.sidebar .row-wrap .row', { hasText: 'Work' });
    await expect(renamed).toBeVisible();

    await lb(page).locator('.row-wrap').hover();
    await lb(page).getByRole('button', { name: 'Edit Work' }).click();
    await lb(page).getByRole('button', { name: 'Delete category' }).click();
    await expect(renamed).toHaveCount(0);
    await lb(page).locator('.toast', { hasText: 'Category Work deleted' }).locator('.toast-action').click();
    await expect(renamed).toContainText('2');
    expect(mock.writes.length).toBe(0);
  });

  test('note search, with-note filter, rendered as text', async ({ context, page }) => {
    await installMock(context, { totalVideos: 30 });
    await openLoaded(page, 30);
    await cards(page).nth(1).hover();
    await cards(page).nth(1).getByRole('button', { name: 'Note' }).click();
    await lb(page).locator('textarea').fill('<img src=x onerror=alert(1)> perché lo stile');
    await press(page, 'Control+Enter');
    await lb(page).locator('.searchbox input').fill('perche stile');
    await expectCount(page, 1);
    const line = cards(page).first().locator('.note-line');
    await expect(line).toContainText("error=alert(1)>");
    await expect(line.locator('img')).toHaveCount(0);
    await expect(line.locator('mark').first()).toHaveText('perché');
    await press(page, 'Escape');
    await lb(page).locator('.sidebar .row', { hasText: 'With note' }).click();
    await expectCount(page, 1);
    await expect(cards(page).first().locator('.note-mark')).toBeVisible();
  });

  test('refresh keeps meta, and a removed video keeps it when re-added', async ({ context, page }) => {
    const mock = await installMock(context, { totalVideos: 12 });
    const saved = mock.videos();
    await openLoaded(page, 12);
    await cards(page).first().hover();
    const firstId = await cards(page).first().getAttribute('data-id');
    await cards(page).first().getByRole('button', { name: 'Note' }).click();
    await lb(page).locator('textarea').fill('Resta');
    await press(page, 'Control+Enter');
    await lb(page).getByRole('button', { name: 'Refresh' }).click();
    await expectCount(page, 12);
    await page.waitForTimeout(350);
    mock.setVideos(saved.slice(1));
    await lb(page).getByRole('button', { name: 'Refresh' }).click();
    await expectCount(page, 11);
    mock.setVideos(saved);
    await lb(page).getByRole('button', { name: 'Refresh' }).click();
    await expectCount(page, 12);
    await expect(lb(page).locator(`[data-id="${firstId}"] .note-mark`)).toBeVisible();
  });

  test('export, clear with two steps, import round trip', async ({ context, page }) => {
    await installMock(context, { totalVideos: 12 });
    await openLoaded(page, 12);
    await lb(page).locator('.check').first().click({ force: true });
    await lb(page).locator('.dock').getByRole('button', { name: 'Categories' }).click();
    await lb(page).getByPlaceholder('Find or create').fill('Backup');
    await press(page, 'Enter');
    await press(page, 'Escape');
    await press(page, 'Escape');
    await cards(page).first().hover();
    await cards(page).first().getByRole('button', { name: 'Note' }).click();
    await lb(page).locator('textarea').fill('Nota nel backup');
    await press(page, 'Control+Enter');

    await lb(page).getByRole('button', { name: 'Settings' }).click();
    const [json] = await Promise.all([page.waitForEvent('download'), lb(page).locator('[data-export=all-json]').click()]);
    const jsonPath = join(tmpdir(), `lb-${Date.now()}.json`);
    await json.saveAs(jsonPath);
    const [csv] = await Promise.all([page.waitForEvent('download'), lb(page).locator('[data-export=all-csv]').click()]);
    expect(csv.suggestedFilename()).toMatch(/^latertidy-.*\.csv$/);
    const csvPath = join(tmpdir(), `lb-${Date.now()}.csv`);
    await csv.saveAs(csvPath);
    const { readFile } = await import('node:fs/promises');
    const csvText = await readFile(csvPath, 'utf8');
    expect(csvText).toContain('Nota nel backup');
    expect(csvText).toContain('Backup');

    const clear = lb(page).getByRole('button', { name: 'Clear local data' });
    await clear.click();
    await lb(page).getByRole('button', { name: 'Confirm: delete everything' }).waitFor();
    await expect(lb(page).locator('.popover')).toContainText('categories, notes');
    await lb(page).getByRole('button', { name: 'Confirm: delete everything' }).click();
    await expect(lb(page).locator('.sidebar .row', { hasText: 'Backup' })).toHaveCount(0);
    await expect(lb(page).locator('.note-mark')).toHaveCount(0);

    await lb(page).getByRole('button', { name: 'Settings' }).click();
    const bad = join(tmpdir(), `lb-bad-${Date.now()}.json`);
    await writeFile(bad, '{"hello":1}');
    await lb(page).locator('[data-import]').setInputFiles(bad);
    await lb(page).locator('.toast.error', { hasText: 'not a LaterTidy backup' }).waitFor();

    await lb(page).getByRole('button', { name: 'Settings' }).click();
    await lb(page).locator('[data-import]').setInputFiles(jsonPath);
    await lb(page).locator('.toast', { hasText: 'Imported 1 categories' }).waitFor();
    await expect(lb(page).locator('.sidebar .row', { hasText: 'Backup' })).toContainText('1');
    await expect(cards(page).first().locator('.note-mark')).toBeVisible();
  });
});

test.describe('themes and scale', () => {
  test('theme follows html[dark] live', async ({ context, page }) => {
    await installMock(context, { totalVideos: 10, dark: false });
    await openLoaded(page, 10);
    await expect(lb(page).locator('.overlay')).toHaveCSS('background-color', 'rgb(255, 255, 255)');
    await page.evaluate(() => document.documentElement.setAttribute('dark', ''));
    await expect(lb(page).locator('.overlay')).toHaveCSS('background-color', 'rgb(15, 15, 15)');
  });

  test('5000 items: loads, scrolls with few DOM nodes, stays responsive', async ({ context, page }) => {
    test.setTimeout(120_000 * SCALE);
    await installMock(context, { totalVideos: 5000 });
    await page.goto(WL);
    await expectCount(page, 5000);
    const result = await lb(page).locator('.scroller').evaluate(async (el) => {
      const gaps: number[] = [];
      let last = performance.now();
      const start = last;
      let stop = false;
      const tick = () => { const n = performance.now(); gaps.push(n - last); last = n; if (!stop) requestAnimationFrame(tick); };
      requestAnimationFrame(tick);
      while (performance.now() - start < 2500) {
        el.scrollTop += 900;
        // The fallback keeps a stalled machine from parking this loop on a frame that never comes.
        await Promise.race([new Promise((r) => requestAnimationFrame(r)), new Promise((r) => setTimeout(r, 250))]);
      }
      stop = true;
      gaps.sort((a, b) => a - b);
      return { p95: gaps[Math.floor(gaps.length * 0.95)]!, max: gaps.at(-1)!, nodes: el.querySelectorAll('*').length, top: el.scrollTop };
    });
    console.log('5000-item scroll', JSON.stringify(result));
    expect(result.top).toBeGreaterThan(10_000);
    if (SCALE === 1) expect(result.p95).toBeLessThan(50);
    expect(result.nodes).toBeLessThan(1500);
    const t0 = Date.now();
    await lb(page).locator('.searchbox input').fill('il');
    await page.waitForFunction(() => true);
    expect(Date.now() - t0).toBeLessThan(500);
  });
});
