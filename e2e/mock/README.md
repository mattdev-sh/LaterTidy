# Mock YouTube harness

Test support for Playwright specs. It serves a fake `www.youtube.com` and `i.ytimg.com` to a browser context, so no spec needs a real account or the network. All data is synthetic.

```ts
import { test, expect } from '../e2e/harness'; // adjust to the spec's location
import { installMock } from '../e2e/mock/mockYouTube'; // adjust to the spec's location
import { makeVideos } from '../e2e/mock/fixtures';

test('removes the selected videos', async ({ context, page }) => {
  const mock = await installMock(context, { totalVideos: 620, dark: true }); // before opening any page
  await page.goto('https://www.youtube.com/playlist?list=WL');

  // ...drive the extension...

  expect(mock.writes[0]?.actions?.[0]?.action).toBe('ACTION_REMOVE_VIDEO');
  expect(mock.videos()).toHaveLength(600);
});
```

## Options

`installMock(context, options)` takes: `totalVideos` (620), `seed` (1), `videos`, `dark`, `loggedIn` (true), `canReorder` (true), `hl` ('en'), `datasyncId`, `cookies` (`'sapisid' | 'secure3p' | 'none'`), `pageSize` (100), `latencyMs` (0).

## Controller

| Member | Purpose |
| --- | --- |
| `writes` | Body of every `browse/edit_playlist` request received, whatever the outcome |
| `writeLog` | The same requests with `status` and `authorization` |
| `reads` | Every other `youtubei` request, as `{ path, body }` |
| `watchVideos` | Ids of each `/watch_videos` request |
| `playlists` | The five other playlists |
| `failNextWrites(n \| predicate, { status, refuse })` | Scripts write failures |
| `clearWriteFailures()` | Drops scripted failures |
| `setVideos(videos)` | Replaces the server list |
| `videos()`, `videoIds()` | Current server list |
| `playlistItems(id)` | Ids added to another playlist |

## Scripted failures

`failNextWrites` counts requests, not chunks, and the client in `src/core/api.ts` retries a 5xx up to three times. So `failNextWrites(1)` is absorbed by a retry, and failing one chunk for good takes `failNextWrites(4)`.

A predicate is usually the better fit for partial failures. It keeps failing matching requests until `clearWriteFailures()`:

```ts
const stale = mock.videos()[30]!.setVideoId;
mock.failNextWrites((body) => body.actions?.some((a) => a.setVideoId === stale) ?? false);
```

`{ refuse: true }` answers 200 with `STATUS_FAILED`, which isn't retried, and `{ status: 401 }` sets the HTTP status. A failed request leaves the server state unchanged.

## How the mock behaves

- `makeVideos` returns the inner `playlistVideoRenderer` objects, and `setVideos` takes the same. Responses add the wrapper.
- An edit applies completely or not at all. An unknown `setVideoId`, playlist or action gets 400 and changes nothing.
- `edit_playlist` without an `Authorization: SAPISIDHASH ...` header gets 401.
- `ACTION_MOVE_VIDEO_AFTER` without `movedSetVideoIdPredecessor` moves to the top, and `ACTION_MOVE_VIDEO_BEFORE` without `movedSetVideoIdSuccessor` moves to the bottom.
- `ACTION_ADD_VIDEO` on `WL` appends the video with a new `setVideoId`.
- `/watch_videos` redirects through `location.replace`, not a 302, because Playwright doesn't route the request that follows a redirect and it would reach the real site. Wait with `page.waitForURL('**/watch?**')`.
- Continuation tokens are offsets into the current list, so editing the list while paging shifts the following pages.
- Other documents get a stub page with the same `ytcfg` and masthead. Other subresources get 404.
- `context.route` covers requests from pages and content scripts. It isn't tested for requests made by the extension's service worker.

`window.__pageKeys` lists the keys that reached the page's `keydown` listener on `document`, for hotkey isolation tests.
