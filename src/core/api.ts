import { sha1Hex } from './sha1';
import { parsePage, parsePlaylists, parseVideo } from './parser';
import type { PlaylistOption, Video, YtConfig } from './types';

export const ORIGIN = 'https://www.youtube.com';
export const CHUNK = 25;
export const CHUNK_GAP_MS = 150;
export const PAGE_GAP_MS = 80;
export const MAX_RETRIES = 3;

export class ApiError extends Error {
  constructor(public kind: 'auth' | 'http' | 'network' | 'parse' | 'status', message: string, public status = 0) {
    super(message);
  }
}

export function cookieSid(cookie: string): string | null {
  const read = (name: string) => {
    for (const part of cookie.split(/;\s*/)) {
      const at = part.indexOf('=');
      if (at > 0 && part.slice(0, at) === name) return part.slice(at + 1);
    }
    return null;
  };
  return read('SAPISID') ?? read('__Secure-3PAPISID');
}

export function authHeader(sid: string, nowSec: number): string {
  return `SAPISIDHASH ${nowSec}_${sha1Hex(`${nowSec} ${sid} ${ORIGIN}`)}`;
}

export function buildHeaders(cfg: YtConfig, sid: string, nowSec: number): Record<string, string> {
  const h: Record<string, string> = {
    'Content-Type': 'application/json',
    Authorization: authHeader(sid, nowSec),
    'X-Origin': ORIGIN,
    'X-Goog-AuthUser': cfg.sessionIndex || '0',
    'X-Youtube-Client-Name': '1',
    'X-Youtube-Client-Version': cfg.clientVersion,
  };
  if (cfg.visitorData) h['X-Goog-Visitor-Id'] = cfg.visitorData;
  if (cfg.delegatedSessionId) h['X-Goog-PageId'] = cfg.delegatedSessionId;
  return h;
}

export const chunk = <T,>(items: readonly T[], size = CHUNK): T[][] => {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
};

export const sleep = (ms: number, signal?: AbortSignal) => new Promise<void>((resolve, reject) => {
  if (signal?.aborted) return reject(new DOMException('Aborted', 'AbortError'));
  const id = setTimeout(resolve, ms);
  signal?.addEventListener('abort', () => { clearTimeout(id); reject(new DOMException('Aborted', 'AbortError')); }, { once: true });
});

export interface Transport {
  (path: string, body: object, init?: { keepalive?: boolean; signal?: AbortSignal }): Promise<Response>;
}

export function fetchTransport(cfg: YtConfig, getCookie: () => string = () => document.cookie): Transport {
  return (path, body, init) => {
    const sid = cookieSid(getCookie());
    if (!sid) throw new ApiError('auth', 'No session cookie');
    return fetch(`${ORIGIN}/youtubei/v1/${path}?prettyPrint=false`, {
      method: 'POST',
      credentials: 'include',
      headers: buildHeaders(cfg, sid, Math.floor(Date.now() / 1000)),
      body: JSON.stringify({ context: cfg.context, ...body }),
      keepalive: init?.keepalive,
      signal: init?.signal,
    });
  };
}

/** Retries 429/5xx and dropped connections with exponential backoff; returns parsed JSON. */
export async function callWithRetry(
  send: Transport, path: string, body: object,
  opts: { signal?: AbortSignal; baseDelay?: number; wait?: typeof sleep } = {},
): Promise<any> {
  const wait = opts.wait ?? sleep;
  const base = opts.baseDelay ?? 500;
  for (let attempt = 0; ; attempt++) {
    let res: Response | null = null;
    try {
      res = await send(path, body, { signal: opts.signal });
    } catch (e) {
      if (e instanceof ApiError || (e as Error)?.name === 'AbortError') throw e;
    }
    if (res?.ok) {
      try { return await res.json(); }
      catch { throw new ApiError('parse', 'Invalid JSON'); }
    }
    if (res?.status === 401 || res?.status === 403) throw new ApiError('auth', `HTTP ${res.status}`, res.status);
    const error = res ? new ApiError('http', `HTTP ${res.status}`, res.status) : new ApiError('network', 'Network error');
    const retryable = !res || res.status === 429 || res.status >= 500;
    if (!retryable || attempt >= MAX_RETRIES) throw error;
    await wait(base * 2 ** attempt, opts.signal);
  }
}

export interface LoadProgress {
  videos: Video[]; canReorder: boolean; isEditable: boolean; total: number | null;
}

/** Pages through the whole playlist. Dedupes ids and preserves firstSeenAt from `known`. */
export async function loadPlaylist(
  send: Transport,
  opts: {
    known: ReadonlyMap<string, number>;
    signal?: AbortSignal;
    onPage?: (p: LoadProgress) => void;
    gapMs?: number;
    now?: number;
  },
): Promise<LoadProgress> {
  const now = opts.now ?? Date.now();
  const seen = new Set<string>();
  const continuations = new Set<string>();
  const state: LoadProgress = { videos: [], canReorder: false, isEditable: true, total: null };
  let json = await callWithRetry(send, 'browse', { browseId: 'VLWL', params: 'wgYCCAA%3D' }, { signal: opts.signal });
  let first = true;
  for (;;) {
    const page = parsePage(json);
    if (first) {
      const isList = page.raws.length > 0 || page.canReorder !== null || page.isEditable !== null;
      if (!isList) throw new ApiError('parse', 'Playlist not found in response');
      state.canReorder = page.canReorder === true;
      state.isEditable = page.isEditable !== false;
      state.total = page.total;
      first = false;
    }
    for (const raw of page.raws) {
      const v = parseVideo(raw, now, opts.known.get(raw?.videoId));
      if (v && !seen.has(v.id)) { seen.add(v.id); state.videos.push(v); }
    }
    opts.onPage?.(state);
    if (!page.continuation) return state;
    if (continuations.has(page.continuation)) throw new ApiError('parse', 'Repeated continuation token');
    continuations.add(page.continuation);
    await sleep(opts.gapMs ?? PAGE_GAP_MS, opts.signal);
    json = await callWithRetry(send, 'browse', { continuation: page.continuation }, { signal: opts.signal });
  }
}

export async function editPlaylist(send: Transport, playlistId: string, actions: object[], opts: { baseDelay?: number; wait?: typeof sleep } = {}) {
  const json = await callWithRetry(send, 'browse/edit_playlist', { playlistId, actions }, opts);
  if (json?.status !== 'STATUS_SUCCEEDED') throw new ApiError('status', 'Edit refused');
}

export interface ChunkRun<T> { done: T[]; failed: T[]; error: ApiError | null }

/**
 * Runs chunks sequentially. A failed chunk doesn't sink the batch, since one stale item fails its
 * whole chunk; three in a row, or an auth failure, stops the run and reports the rest as failed.
 */
export async function runChunks<T>(
  items: readonly T[], run: (group: T[]) => Promise<void>,
  opts: { gapMs?: number; onProgress?: (done: number, total: number, settled: T[]) => void } = {},
): Promise<ChunkRun<T>> {
  const out: ChunkRun<T> = { done: [], failed: [], error: null };
  const groups = chunk(items);
  let streak = 0;
  for (let i = 0; i < groups.length; i++) {
    const group = groups[i]!;
    try {
      await run(group);
      out.done.push(...group);
      streak = 0;
    } catch (e) {
      out.failed.push(...group);
      out.error = e instanceof ApiError ? e : new ApiError('network', String(e));
      if (++streak >= 3 || out.error.kind === 'auth' || (e as Error)?.name === 'AbortError') {
        for (const rest of groups.slice(i + 1)) out.failed.push(...rest);
        opts.onProgress?.(out.done.length, items.length, groups.slice(i).flat());
        break;
      }
    }
    opts.onProgress?.(out.done.length, items.length, group);
    if (i < groups.length - 1) await sleep(opts.gapMs ?? CHUNK_GAP_MS);
  }
  return out;
}

export const removeAction = (setVideoId: string) => ({ action: 'ACTION_REMOVE_VIDEO', setVideoId });

export async function removeVideos(
  send: Transport, videos: readonly Video[],
  opts: { gapMs?: number; onProgress?: (done: number, total: number, settled: Video[]) => void } = {},
) {
  return runChunks(videos, (g) => editPlaylist(send, 'WL', g.map((v) => removeAction(v.setVideoId))), opts);
}

/** Moves to one end. Order is chosen so the moved set keeps its relative order there. */
export async function moveVideos(send: Transport, videos: readonly Video[], to: 'top' | 'bottom') {
  const action = to === 'top' ? 'ACTION_MOVE_VIDEO_AFTER' : 'ACTION_MOVE_VIDEO_BEFORE';
  const ordered = to === 'top' ? [...videos].reverse() : videos;
  return runChunks(ordered, (g) => editPlaylist(send, 'WL', g.map((v) => ({ action, setVideoId: v.setVideoId }))));
}

export async function addToPlaylist(send: Transport, playlistId: string, videos: readonly Video[]) {
  return runChunks(videos, (g) => editPlaylist(send, playlistId, g.map((v) => ({ action: 'ACTION_ADD_VIDEO', addedVideoId: v.id }))));
}

export async function listPlaylists(send: Transport, videoId: string): Promise<PlaylistOption[]> {
  const json = await callWithRetry(send, 'playlist/get_add_to_playlist', { videoIds: [videoId], excludeWatchLater: true });
  return parsePlaylists(json);
}

/** Keepalive bodies share a 64 KiB in-flight budget; stay under it and hand back the rest. */
export const KEEPALIVE_BUDGET = 60_000;

export function removeKeepalive(send: Transport, videos: readonly Video[], bodyBaseSize: number): Video[] {
  let budget = KEEPALIVE_BUDGET;
  const groups = chunk(videos);
  for (let i = 0; i < groups.length; i++) {
    const actions = groups[i]!.map((v) => removeAction(v.setVideoId));
    const size = bodyBaseSize + new TextEncoder().encode(JSON.stringify(actions)).byteLength;
    if (size > budget) return groups.slice(i).flat();
    budget -= size;
    try { void send('browse/edit_playlist', { playlistId: 'WL', actions }, { keepalive: true }).catch(() => {}); }
    catch { return groups.slice(i).flat(); }
  }
  return [];
}
