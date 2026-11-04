import type { BrowserContext, Route } from '@playwright/test';
import {
  MOCK_PLAYLISTS, PAGE_SIZE, addToPlaylistResponse, browseResponse, continuationResponse, hashString, makeVideos,
  pageHtml, parseContinuationToken, sessionCookies, signedOutBrowseResponse, thumbnailSvg,
} from './fixtures';
import type { CookieVariant, MockPlaylist, PlaylistVideoRenderer } from './fixtures';

export interface MockOptions {
  /** Default 620. Ignored when `videos` is given. */
  totalVideos?: number;
  /** Seed for generated videos. Default 1. */
  seed?: number;
  /** Starting list, instead of generated videos. */
  videos?: PlaylistVideoRenderer[];
  dark?: boolean;
  /** Default true. False also sets no cookie, unless `cookies` says otherwise. */
  loggedIn?: boolean;
  /** Default true. */
  canReorder?: boolean;
  /** Default 'it'. */
  hl?: string;
  /** Default 'test-datasync||'. */
  datasyncId?: string;
  /** Default 'sapisid' when logged in, 'none' otherwise. */
  cookies?: CookieVariant;
  /** Videos per browse page. Default 100. */
  pageSize?: number;
  /** Delay for each youtubei request, to make loading and progress states observable. Default 0. */
  latencyMs?: number;
}

export interface EditAction {
  action: string;
  setVideoId?: string;
  addedVideoId?: string;
  movedSetVideoIdPredecessor?: string;
  movedSetVideoIdSuccessor?: string;
  [key: string]: unknown;
}

export interface EditBody {
  playlistId?: string;
  actions?: EditAction[];
  [key: string]: unknown;
}

export interface WriteRecord {
  body: EditBody;
  /** Response status. 401 for bad auth, 400 for an edit the mock can't apply. */
  status: number;
  authorization: string | undefined;
}

export interface ReadRecord {
  /** Path after /youtubei/v1/, such as 'browse' or 'playlist/get_add_to_playlist'. */
  path: string;
  body: Record<string, unknown>;
}

export interface FailOptions {
  /** Default 500. */
  status?: number;
  /** Answer 200 with `{status:'STATUS_FAILED'}` instead of an HTTP error. */
  refuse?: boolean;
}

export type WritePredicate = (body: EditBody) => boolean;

export interface MockController {
  /** Body of every edit_playlist request received, in order, whatever the outcome. */
  readonly writes: EditBody[];
  /** Same requests as `writes`, with status and Authorization header. */
  readonly writeLog: WriteRecord[];
  /** Every other youtubei request received. */
  readonly reads: ReadRecord[];
  /** Ids of each /watch_videos request. */
  readonly watchVideos: string[][];
  /** The other playlists offered by get_add_to_playlist. */
  readonly playlists: readonly MockPlaylist[];
  /**
   * Scripts failures. A number fails that many next requests. A predicate fails every matching
   * request until `clearWriteFailures()`. A failed request changes nothing on the server.
   */
  failNextWrites(what: number | WritePredicate, options?: FailOptions): void;
  clearWriteFailures(): void;
  /** Replaces the Watch Later list on the server. */
  setVideos(videos: PlaylistVideoRenderer[]): void;
  /** Current Watch Later list on the server. */
  videos(): PlaylistVideoRenderer[];
  videoIds(): string[];
  /** Video ids added to one of the other playlists. */
  playlistItems(playlistId: string): string[];
}

interface FailureRule extends FailOptions {
  remaining: number;
  predicate?: WritePredicate;
}

class EditError extends Error {}

const WATCH_LATER = 'WL';

function bodyOf(route: Route): Record<string, unknown> {
  try {
    const body: unknown = route.request().postDataJSON();
    return body && typeof body === 'object' ? (body as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

const fulfillJson = (route: Route, json: unknown, status = 200) =>
  route.fulfill({ status, contentType: 'application/json; charset=utf-8', body: JSON.stringify(json) });

/**
 * Serves a fake www.youtube.com and i.ytimg.com to a browser context and sets the session cookie.
 * Call it before opening any page. Nothing reaches the network for these hosts.
 */
export async function installMock(context: BrowserContext, options: MockOptions = {}): Promise<MockController> {
  const { totalVideos = 620, seed = 1, dark, loggedIn = true, canReorder = true, hl, datasyncId, pageSize = PAGE_SIZE, latencyMs = 0 } = options;

  let videos = [...(options.videos ?? makeVideos(totalVideos, seed))];
  /** Every video ever on the list, so a removed one can be added back with its details. */
  const known = new Map(videos.map((v) => [v.videoId, v]));
  const others = new Map<string, string[]>(MOCK_PLAYLISTS.map((p) => [p.playlistId, []]));
  const rules: FailureRule[] = [];
  const writes: EditBody[] = [];
  const writeLog: WriteRecord[] = [];
  const reads: ReadRecord[] = [];
  const watchVideos: string[][] = [];
  let setVideoIds = 0;

  await context.addCookies(sessionCookies(options.cookies ?? (loggedIn ? 'sapisid' : 'none')));

  const freshSetVideoId = () => `MOCK${String(++setVideoIds).padStart(12, '0')}`;

  function takeFailure(body: EditBody): FailureRule | null {
    for (let i = 0; i < rules.length; i++) {
      const rule = rules[i] as FailureRule;
      if (rule.predicate) {
        if (rule.predicate(body)) return rule;
      } else {
        if (--rule.remaining <= 0) rules.splice(i, 1);
        return rule;
      }
    }
    return null;
  }

  function positionOf(list: readonly PlaylistVideoRenderer[], setVideoId: unknown): number {
    const at = list.findIndex((v) => v.setVideoId === setVideoId);
    if (at < 0) throw new EditError(`Unknown setVideoId ${String(setVideoId)}`);
    return at;
  }

  function applyToWatchLater(actions: EditAction[]): PlaylistVideoRenderer[] {
    const list = [...videos];
    for (const edit of actions) {
      switch (edit.action) {
        case 'ACTION_REMOVE_VIDEO':
          list.splice(positionOf(list, edit.setVideoId), 1);
          break;
        case 'ACTION_MOVE_VIDEO_AFTER': {
          // No predecessor means the top of the list.
          const [moved] = list.splice(positionOf(list, edit.setVideoId), 1);
          const after = edit.movedSetVideoIdPredecessor;
          list.splice(after === undefined ? 0 : positionOf(list, after) + 1, 0, moved as PlaylistVideoRenderer);
          break;
        }
        case 'ACTION_MOVE_VIDEO_BEFORE': {
          // No successor means the bottom of the list.
          const [moved] = list.splice(positionOf(list, edit.setVideoId), 1);
          const before = edit.movedSetVideoIdSuccessor;
          list.splice(before === undefined ? list.length : positionOf(list, before), 0, moved as PlaylistVideoRenderer);
          break;
        }
        case 'ACTION_ADD_VIDEO': {
          const id = edit.addedVideoId;
          if (typeof id !== 'string') throw new EditError('ACTION_ADD_VIDEO without addedVideoId');
          if (list.some((v) => v.videoId === id)) break;
          const base = known.get(id) ?? (makeVideos(1, hashString(id))[0] as PlaylistVideoRenderer);
          // A re-added video gets a new setVideoId, as a new playlist entry.
          list.push({ ...base, videoId: id, setVideoId: freshSetVideoId() });
          break;
        }
        default:
          throw new EditError(`Unsupported action ${edit.action}`);
      }
    }
    return list;
  }

  function applyToOther(playlistId: string, actions: EditAction[]): string[] {
    const list = others.get(playlistId);
    if (!list) throw new EditError(`Unknown playlist ${playlistId}`);
    const next = [...list];
    for (const edit of actions) {
      if (edit.action !== 'ACTION_ADD_VIDEO' || typeof edit.addedVideoId !== 'string') {
        throw new EditError(`Unsupported action ${edit.action} on ${playlistId}`);
      }
      if (!next.includes(edit.addedVideoId)) next.push(edit.addedVideoId);
    }
    return next;
  }

  /** Applies a whole request or nothing, so one bad item fails its chunk. */
  function applyEdit(body: EditBody): void {
    const { playlistId, actions } = body;
    if (typeof playlistId !== 'string') throw new EditError('Missing playlistId');
    if (!Array.isArray(actions) || !actions.length) throw new EditError('Missing actions');
    if (playlistId !== WATCH_LATER) {
      others.set(playlistId, applyToOther(playlistId, actions));
      return;
    }
    const next = applyToWatchLater(actions);
    for (const video of next) known.set(video.videoId, video);
    videos = next;
  }

  async function handleEdit(route: Route): Promise<void> {
    const body = bodyOf(route) as EditBody;
    const authorization = (await route.request().allHeaders())['authorization'];
    const record: WriteRecord = { body, status: 200, authorization };
    writes.push(body);
    writeLog.push(record);
    if (!authorization?.startsWith('SAPISIDHASH ')) {
      record.status = 401;
      return fulfillJson(route, { error: { code: 401, status: 'UNAUTHENTICATED' } }, 401);
    }
    const failure = takeFailure(body);
    if (failure?.refuse) return fulfillJson(route, { status: 'STATUS_FAILED' });
    if (failure) {
      record.status = failure.status ?? 500;
      return fulfillJson(route, { error: { code: record.status, status: 'INTERNAL' } }, record.status);
    }
    try {
      applyEdit(body);
    } catch (error) {
      if (!(error instanceof EditError)) throw error;
      record.status = 400;
      return fulfillJson(route, { error: { code: 400, status: 'INVALID_ARGUMENT', message: error.message } }, 400);
    }
    return fulfillJson(route, { status: 'STATUS_SUCCEEDED' });
  }

  function handleBrowse(route: Route, body: Record<string, unknown>): Promise<void> {
    if (!loggedIn) return fulfillJson(route, signedOutBrowseResponse());
    if ('continuation' in body) {
      const offset = parseContinuationToken(body.continuation);
      if (offset === null) return fulfillJson(route, { error: { code: 400, status: 'INVALID_ARGUMENT' } }, 400);
      return fulfillJson(route, continuationResponse(videos, offset, pageSize));
    }
    if (body.browseId !== 'VLWL') return fulfillJson(route, { responseContext: {} });
    return fulfillJson(route, browseResponse(videos, { canReorder, pageSize }));
  }

  function handleAddToPlaylist(route: Route, body: Record<string, unknown>): Promise<void> {
    const ids = Array.isArray(body.videoIds) ? (body.videoIds as string[]) : [];
    const contains = new Set<string>();
    for (const [playlistId, items] of others) {
      if (ids.length && ids.every((id) => items.includes(id))) contains.add(playlistId);
    }
    return fulfillJson(route, addToPlaylistResponse(MOCK_PLAYLISTS, contains));
  }

  async function handleApi(route: Route, path: string): Promise<void> {
    if (latencyMs) await new Promise((resolve) => setTimeout(resolve, latencyMs));
    if (path === 'browse/edit_playlist') return handleEdit(route);
    const body = bodyOf(route);
    reads.push({ path, body });
    if (path === 'browse') return handleBrowse(route, body);
    if (path === 'playlist/get_add_to_playlist') return handleAddToPlaylist(route, body);
    return fulfillJson(route, { responseContext: {} });
  }

  function serveDocument(route: Route, kind: 'playlist' | 'watch' | 'home'): Promise<void> {
    const html = pageHtml({ dark, loggedIn, canReorder, hl, datasyncId, kind, videos: videos.slice(0, 12) });
    return route.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: html });
  }

  await context.route('https://www.youtube.com/**', async (route) => {
    const request = route.request();
    const { pathname, searchParams } = new URL(request.url());
    if (pathname.startsWith('/youtubei/v1/')) {
      return request.method() === 'POST' ? handleApi(route, pathname.slice('/youtubei/v1/'.length)) : route.fulfill({ status: 405 });
    }
    if (pathname === '/watch_videos') {
      const ids = (searchParams.get('video_ids') ?? '').split(',').filter(Boolean);
      watchVideos.push(ids);
      // Not a 302: Playwright doesn't route the follow-up of a redirect, so it would reach the network.
      const target = `/watch?v=${encodeURIComponent(ids[0] ?? '')}&list=TLmockqueue`;
      const body = `<!doctype html><script>location.replace(${JSON.stringify(target)})</script>`;
      return route.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body });
    }
    if (!request.isNavigationRequest()) return route.fulfill({ status: 404 });
    if (pathname === '/playlist') return serveDocument(route, 'playlist');
    return serveDocument(route, pathname === '/watch' ? 'watch' : 'home');
  });

  await context.route('https://i.ytimg.com/**', (route) => {
    const key = new URL(route.request().url()).pathname;
    return route.fulfill({ status: 200, contentType: 'image/svg+xml', headers: { 'cache-control': 'max-age=3600' }, body: thumbnailSvg(key) });
  });

  return {
    writes,
    writeLog,
    reads,
    watchVideos,
    playlists: MOCK_PLAYLISTS,
    failNextWrites(what, failOptions = {}) {
      if (typeof what === 'function') rules.push({ ...failOptions, remaining: Infinity, predicate: what });
      else if (what > 0) rules.push({ ...failOptions, remaining: what });
    },
    clearWriteFailures() {
      rules.length = 0;
    },
    setVideos(next) {
      videos = [...next];
      for (const video of videos) known.set(video.videoId, video);
    },
    videos: () => [...videos],
    videoIds: () => videos.map((v) => v.videoId),
    playlistItems: (playlistId) => [...(others.get(playlistId) ?? [])],
  };
}
