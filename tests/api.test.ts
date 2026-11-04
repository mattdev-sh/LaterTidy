import { describe, expect, it, vi } from 'vitest';
import {
  ApiError, authHeader, buildHeaders, callWithRetry, chunk, cookieSid, editPlaylist, loadPlaylist, moveVideos, addToPlaylist,
  removeKeepalive, removeVideos, runChunks, type Transport,
} from '../src/core/api';
import { sha1Hex } from '../src/core/sha1';
import type { YtConfig } from '../src/core/types';
import { continuation, initial, item, nextPage, raw, video } from './fixtures';

const ok = (body: unknown) => new Response(JSON.stringify(body), { status: 200 });
const status = (code: number) => new Response('{}', { status: code });
const succeeded = () => ok({ status: 'STATUS_SUCCEEDED' });
const noWait = async () => {};

describe('auth', () => {
  it('prefers SAPISID and falls back to __Secure-3PAPISID', () => {
    expect(cookieSid('a=1; SAPISID=main; __Secure-3PAPISID=alt')).toBe('main');
    expect(cookieSid('a=1; __Secure-3PAPISID=alt')).toBe('alt');
    expect(cookieSid('a=1')).toBeNull();
  });
  it('builds SAPISIDHASH', () => {
    expect(authHeader('sid', 100)).toBe(`SAPISIDHASH 100_${sha1Hex('100 sid https://www.youtube.com')}`);
  });
  it('sets session headers and optional page id', () => {
    const cfg: YtConfig = { apiKey: '', clientVersion: '2.1', context: {}, sessionIndex: '2', delegatedSessionId: '', datasyncId: 'd', visitorData: 'V', loggedIn: true, hl: 'it' };
    const h = buildHeaders(cfg, 's', 1);
    expect(h).toMatchObject({ 'X-Goog-AuthUser': '2', 'X-Youtube-Client-Name': '1', 'X-Youtube-Client-Version': '2.1', 'X-Goog-Visitor-Id': 'V', 'X-Origin': 'https://www.youtube.com' });
    expect(h['X-Goog-PageId']).toBeUndefined();
    expect(buildHeaders({ ...cfg, delegatedSessionId: 'P' }, 's', 1)['X-Goog-PageId']).toBe('P');
  });
});

describe('chunking', () => {
  it('splits into 25', () => {
    expect(chunk(new Array(300).fill(0))).toHaveLength(12);
    expect(chunk(new Array(26).fill(0)).map((c) => c.length)).toEqual([25, 1]);
    expect(chunk([])).toEqual([]);
  });
});

describe('retry', () => {
  it('retries 429 and 5xx with backoff, then succeeds', async () => {
    const send = vi.fn<Transport>().mockResolvedValueOnce(status(429)).mockResolvedValueOnce(status(503)).mockResolvedValue(ok({ fine: 1 }));
    const wait = vi.fn(async (_ms: number) => {});
    await expect(callWithRetry(send, 'x', {}, { wait })).resolves.toEqual({ fine: 1 });
    expect(wait.mock.calls.map((c) => c[0])).toEqual([500, 1000]);
  });
  it('gives up after three retries', async () => {
    const send = vi.fn<Transport>(async () => status(500));
    await expect(callWithRetry(send, 'x', {}, { wait: noWait })).rejects.toMatchObject({ kind: 'http', status: 500 });
    expect(send).toHaveBeenCalledTimes(4);
  });
  it('retries dropped connections', async () => {
    const send = vi.fn<Transport>().mockRejectedValueOnce(new TypeError('failed')).mockResolvedValue(ok({}));
    await expect(callWithRetry(send, 'x', {}, { wait: noWait })).resolves.toEqual({});
  });
  it('does not retry 400, 401 or abort', async () => {
    const s400 = vi.fn<Transport>(async () => status(400));
    await expect(callWithRetry(s400, 'x', {}, { wait: noWait })).rejects.toMatchObject({ kind: 'http' });
    expect(s400).toHaveBeenCalledTimes(1);
    const s401 = vi.fn<Transport>(async () => status(401));
    await expect(callWithRetry(s401, 'x', {}, { wait: noWait })).rejects.toMatchObject({ kind: 'auth' });
    const abort = vi.fn<Transport>(async () => { throw new DOMException('x', 'AbortError'); });
    await expect(callWithRetry(abort, 'x', {}, { wait: noWait })).rejects.toMatchObject({ name: 'AbortError' });
    expect(abort).toHaveBeenCalledTimes(1);
  });
  it('flags invalid JSON as a parse error', async () => {
    const send: Transport = async () => new Response('<html>', { status: 200 });
    await expect(callWithRetry(send, 'x', {}, { wait: noWait })).rejects.toMatchObject({ kind: 'parse' });
  });
});

describe('edit calls', () => {
  it('needs STATUS_SUCCEEDED', async () => {
    const refused: Transport = async () => ok({ status: 'STATUS_FAILED' });
    await expect(editPlaylist(refused, 'WL', [])).rejects.toMatchObject({ kind: 'status' });
  });
  it('sends remove payloads in chunks of 25', async () => {
    const bodies: any[] = [];
    const send: Transport = async (path, body) => { expect(path).toBe('browse/edit_playlist'); bodies.push(body); return succeeded(); };
    const vids = Array.from({ length: 60 }, (_, i) => video(`v${i}`));
    const run = await removeVideos(send, vids, { gapMs: 0 });
    expect(bodies.map((b) => b.actions.length)).toEqual([25, 25, 10]);
    expect(bodies[0].playlistId).toBe('WL');
    expect(bodies[0].actions[0]).toEqual({ action: 'ACTION_REMOVE_VIDEO', setVideoId: 'set-v0' });
    expect(run.done).toHaveLength(60);
  });
  it('sends move and add payloads', async () => {
    const bodies: any[] = [];
    const send: Transport = async (_, body) => { bodies.push(body); return succeeded(); };
    await moveVideos(send, [video('a'), video('b')], 'top');
    await moveVideos(send, [video('a'), video('b')], 'bottom');
    await addToPlaylist(send, 'PL9', [video('a')]);
    expect(bodies[0].actions).toEqual([{ action: 'ACTION_MOVE_VIDEO_AFTER', setVideoId: 'set-b' }, { action: 'ACTION_MOVE_VIDEO_AFTER', setVideoId: 'set-a' }]);
    expect(bodies[1].actions[0]).toEqual({ action: 'ACTION_MOVE_VIDEO_BEFORE', setVideoId: 'set-a' });
    expect(bodies[2]).toEqual({ playlistId: 'PL9', actions: [{ action: 'ACTION_ADD_VIDEO', addedVideoId: 'a' }] });
  });
});

describe('runChunks', () => {
  const items = Array.from({ length: 100 }, (_, i) => i);
  it('isolates one failed chunk', async () => {
    let n = 0;
    const run = await runChunks(items, async () => { if (n++ === 1) throw new ApiError('status', 'x'); }, { gapMs: 0 });
    expect(run.done).toHaveLength(75);
    expect(run.failed).toEqual(items.slice(25, 50));
  });
  it('stops after three failures in a row', async () => {
    const seen: number[] = [];
    const run = await runChunks(items, async (g) => { seen.push(g[0]!); throw new ApiError('http', 'x'); }, { gapMs: 0 });
    expect(seen).toEqual([0, 25, 50]);
    expect(run.failed).toHaveLength(100);
  });
  it('stops at once on an auth failure', async () => {
    const run = await runChunks(items, async () => { throw new ApiError('auth', 'x'); }, { gapMs: 0 });
    expect(run.failed).toHaveLength(100);
    expect(run.error?.kind).toBe('auth');
  });
  it('reports progress', async () => {
    const seen: number[] = [];
    await runChunks(items, async () => {}, { gapMs: 0, onProgress: (d) => seen.push(d) });
    expect(seen).toEqual([25, 50, 75, 100]);
  });
  it('settles only the current and remaining chunks when auth fails after a partial failure', async () => {
    let n = 0;
    const settled: number[][] = [];
    await runChunks(items, async () => {
      const at = n++;
      if (at === 0) throw new ApiError('status', 'stale entry');
      if (at === 2) throw new ApiError('auth', 'signed out');
    }, { gapMs: 0, onProgress: (_done, _total, group) => settled.push(group) });
    expect(settled).toEqual([items.slice(0, 25), items.slice(25, 50), items.slice(50)]);
  });
});

describe('loadPlaylist', () => {
  it('pages through, dedupes, keeps firstSeenAt and passes the unavailable param', async () => {
    const calls: any[] = [];
    const pages = [
      initial([item(raw('aaaaaaaaaaa')), continuation('T1')], { isEditable: true, canReorder: true }),
      nextPage([item(raw('aaaaaaaaaaa')), item(raw('bbbbbbbbbbb')), continuation('T2')]),
      nextPage([item(raw('ccccccccccc'))]),
    ];
    const send: Transport = async (_, body) => { calls.push(body); return ok(pages[calls.length - 1]); };
    const seen: number[] = [];
    const res = await loadPlaylist(send, { known: new Map([['aaaaaaaaaaa', 7]]), gapMs: 0, now: 99, onPage: (p) => seen.push(p.videos.length) });
    expect(calls[0]).toEqual({ browseId: 'VLWL', params: 'wgYCCAA%3D' });
    expect(calls[1]).toEqual({ continuation: 'T1' });
    expect(res.videos.map((v) => v.firstSeenAt)).toEqual([7, 99, 99]);
    expect(seen).toEqual([1, 2, 3]);
    expect(res.canReorder).toBe(true);
  });
  it('treats an empty editable playlist as valid', async () => {
    const send: Transport = async () => ok(initial([]));
    await expect(loadPlaylist(send, { known: new Map() })).resolves.toMatchObject({ videos: [] });
  });
  it('rejects a reply with no playlist', async () => {
    const send: Transport = async () => ok({ alerts: [] });
    await expect(loadPlaylist(send, { known: new Map() })).rejects.toMatchObject({ kind: 'parse' });
  });
  it('can be aborted', async () => {
    const ctl = new AbortController();
    const send: Transport = async () => ok(initial([item(raw('aaaaaaaaaaa')), continuation('T')]));
    const p = loadPlaylist(send, { known: new Map(), signal: ctl.signal, gapMs: 1000 });
    setTimeout(() => ctl.abort(), 5);
    await expect(p).rejects.toMatchObject({ name: 'AbortError' });
  });
  it('stops instead of looping forever when a continuation token repeats', async () => {
    const send = vi.fn<Transport>(async () => ok(initial([item(raw('aaaaaaaaaaa')), continuation('same')])));
    await expect(loadPlaylist(send, { known: new Map(), gapMs: 0 })).rejects.toMatchObject({ kind: 'parse' });
    expect(send).toHaveBeenCalledTimes(2);
  });
});

describe('removeKeepalive', () => {
  it('sends what fits in the budget and returns the rest', () => {
    const sent: any[] = [];
    const send: Transport = (_, body, init) => { expect(init?.keepalive).toBe(true); sent.push(body); return Promise.resolve(status(200)); };
    const vids = Array.from({ length: 1000 }, (_, i) => video(`v${i}`));
    const left = removeKeepalive(send, vids, 8000);
    expect(sent.length).toBeGreaterThan(0);
    expect(sent.length * 25 + left.length).toBe(1000);
    expect(left.length).toBeGreaterThan(0);
  });
  it('hands everything back if there is no session', () => {
    const send: Transport = () => { throw new ApiError('auth', 'x'); };
    expect(removeKeepalive(send, [video('a')], 100)).toHaveLength(1);
  });
  it('counts UTF-8 bytes rather than JavaScript string length', () => {
    const send = vi.fn<Transport>(async () => status(200));
    const vids = Array.from({ length: 50 }, (_, i) => video(`v${i}`, { setVideoId: '🙂'.repeat(500) + i }));
    const left = removeKeepalive(send, vids, 100);
    expect(send).toHaveBeenCalledTimes(1);
    expect(left).toHaveLength(25);
  });
});
