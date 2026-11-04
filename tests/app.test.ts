import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from '../src/app/app';
import { metaKey, snapshotKey, accountKey } from '../src/core/storage';
import type { YtConfig } from '../src/core/types';
import { initial, item, raw, video } from './fixtures';

const cfg: YtConfig = { apiKey: '', clientVersion: '2.1', context: {}, sessionIndex: '0', delegatedSessionId: '', datasyncId: 'acct', visitorData: '', loggedIn: true, hl: 'it' };

let store: Record<string, unknown>;
const writes: string[] = [];

beforeEach(() => {
  store = {};
  writes.length = 0;
  vi.stubGlobal('document', { cookie: 'SAPISID=x' });
  vi.stubGlobal('chrome', {
    runtime: { id: 'test' },
    storage: { local: {
      get: async (key: string) => ({ [key]: store[key] }),
      set: async (o: Record<string, unknown>) => { for (const k of Object.keys(o)) { writes.push(k); store[k] = o[k]; } },
      remove: async () => {},
    } },
  });
  vi.stubGlobal('fetch', async () => new Response(JSON.stringify(initial([item(raw('aaaaaaaaaaa'))])), { status: 200 }));
});
afterEach(() => { vi.unstubAllGlobals(); });

const settled = async (app: App) => vi.waitFor(() => expect(app.state.refresh).toBeNull());

describe('App storage', () => {
  it('a background refresh never writes the meta key, and meta survives it', async () => {
    const acct = await accountKey('acct', '0');
    const stored = { categories: [{ id: 'c1', name: 'Studio', color: '#0E8F80' }], videos: { aaaaaaaaaaa: { categoryIds: ['c1'], note: 'n', updatedAt: 1 } } };
    store[metaKey(acct)] = stored;
    const app = new App();
    await app.start(cfg);
    await settled(app);
    expect(app.state.videos).toHaveLength(1);
    expect(writes).toContain(snapshotKey(acct));
    expect(writes).not.toContain(metaKey(acct));
    expect(store[metaKey(acct)]).toEqual(stored);
    expect(app.state.meta.videos.aaaaaaaaaaa!.note).toBe('n');
    expect(JSON.stringify(store[snapshotKey(acct)])).not.toContain('Studio');
  });

  it('keeps a removed video\'s meta so re-adding restores it', async () => {
    const app = new App();
    await app.start(cfg);
    await settled(app);
    app.saveNote('aaaaaaaaaaa', 'resta');
    (app as unknown as { dropVideos(ids: string[]): void }).dropVideos(['aaaaaaaaaaa']);
    expect(app.state.videos).toHaveLength(0);
    expect(app.state.meta.videos.aaaaaaaaaaa!.note).toBe('resta');
  });

  it('separates accounts', async () => {
    expect(await accountKey('one', '0')).not.toBe(await accountKey('two', '0'));
    expect(await accountKey('one', '0')).toMatch(/^[0-9a-f]{16}$/);
    expect(await accountKey('', '2')).not.toBe(await accountKey('', '1'));
  });

  it('switching accounts flushes old notes and clears old selections, filters and removals', async () => {
    const app = new App();
    await app.start(cfg);
    await settled(app);
    const oldAcct = await accountKey(cfg.datasyncId, cfg.sessionIndex);
    const nextCfg = { ...cfg, datasyncId: 'another-account', sessionIndex: '1' };
    const nextAcct = await accountKey(nextCfg.datasyncId, nextCfg.sessionIndex);
    store[snapshotKey(nextAcct)] = { v: 1, savedAt: 0, videos: [video('bbbbbbbbbbb')], canReorder: false, isEditable: true };
    app.saveNote('aaaaaaaaaaa', 'old account note');
    app.setFilters({ query: 'old search' });
    app.toggleSelect('aaaaaaaaaaa');
    app.removeIds(['aaaaaaaaaaa']);
    const oldQueue = app.queue;
    await app.start(nextCfg);
    expect(oldQueue.busy).toBe(false);
    expect(app.state.meta.videos.aaaaaaaaaaa).toBeUndefined();
    expect(app.state.filters.query).toBe('');
    expect(app.state.selection.size).toBe(0);
    expect(app.state.hidden.size).toBe(0);
    expect(app.state.toasts).toHaveLength(0);
    expect((store[metaKey(oldAcct)] as any).videos.aaaaaaaaaaa.note).toBe('old account note');
    expect(store[metaKey(nextAcct)]).toBeUndefined();
    await settled(app);
  });

  it('signing out clears private account data and aborts an old refresh', async () => {
    const app = new App();
    await app.start(cfg);
    await settled(app);
    let release = (_value: Response) => {};
    vi.stubGlobal('fetch', () => new Promise<Response>((resolve) => { release = resolve; }));
    app.refresh();
    await app.start({ ...cfg, loggedIn: false });
    release(new Response(JSON.stringify(initial([item(raw('bbbbbbbbbbb'))])), { status: 200 }));
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(app.state.phase).toBe('loggedOut');
    expect(app.state.videos).toHaveLength(0);
    expect(app.state.refresh).toBeNull();
  });

  it('a late removal response from the previous account cannot remove a new account video', async () => {
    const app = new App();
    await app.start(cfg);
    await settled(app);
    let release = (_value: Response) => {};
    let editing = false;
    vi.stubGlobal('fetch', async (url: string) => {
      if (url.includes('edit_playlist')) {
        editing = true;
        return new Promise<Response>((resolve) => { release = resolve; });
      }
      return new Response(JSON.stringify(initial([item(raw('aaaaaaaaaaa'))])), { status: 200 });
    });
    app.removeIds(['aaaaaaaaaaa']);
    app.queue.commitNow();
    await vi.waitFor(() => expect(editing).toBe(true));
    await app.start({ ...cfg, datasyncId: 'new-account' });
    await settled(app);
    release(new Response(JSON.stringify({ status: 'STATUS_SUCCEEDED' }), { status: 200 }));
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(app.state.videos.map((v) => v.id)).toEqual(['aaaaaaaaaaa']);
    expect(app.state.hidden.size).toBe(0);
    expect(app.state.commit).toBeNull();
  });
});
