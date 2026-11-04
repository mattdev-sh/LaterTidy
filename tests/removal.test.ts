import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError, type ChunkRun } from '../src/core/api';
import { RemovalQueue, UNDO_MS, type RemovalDeps } from '../src/core/removal';
import type { Video } from '../src/core/types';
import { video } from './fixtures';

const vids = (...ids: string[]) => ids.map((id) => video(id));
const allOk = (items: Video[]): ChunkRun<Video> => ({ done: items, failed: [], error: null });

function setup(commit: RemovalDeps['commit'] = async (items) => allOk(items), keepalive: RemovalDeps['commitKeepalive'] = () => []) {
  const deps = {
    commit: vi.fn(commit), commitKeepalive: vi.fn(keepalive),
    onHide: vi.fn(), onRestore: vi.fn(), onRemoved: vi.fn(), onPending: vi.fn(), onProgress: vi.fn(), onFailed: vi.fn(), onLeftover: vi.fn(),
  };
  return { deps, q: new RemovalQueue(deps) };
}

beforeEach(() => { vi.useFakeTimers(); });
afterEach(() => { vi.useRealTimers(); });

describe('RemovalQueue', () => {
  it('hides at once and sends nothing until the window ends', async () => {
    const { q, deps } = setup();
    q.remove(vids('a', 'b'));
    expect(deps.onHide).toHaveBeenCalledWith(['a', 'b']);
    await vi.advanceTimersByTimeAsync(UNDO_MS - 1);
    expect(deps.commit).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(deps.commit).toHaveBeenCalledTimes(1);
    expect(deps.onRemoved).toHaveBeenCalledWith(['a', 'b']);
    expect(deps.onRestore).not.toHaveBeenCalled();
  });

  it('undo restores and nothing is ever sent', async () => {
    const { q, deps } = setup();
    q.remove(vids('a'));
    expect(q.undo()).toBe(1);
    expect(deps.onRestore).toHaveBeenCalledWith(['a']);
    await vi.advanceTimersByTimeAsync(UNDO_MS * 2);
    expect(deps.commit).not.toHaveBeenCalled();
    expect(q.undo()).toBe(0);
  });

  it('a new batch commits the pending one first, in order', async () => {
    const { q, deps } = setup();
    q.remove(vids('a'));
    q.remove(vids('b'));
    await vi.advanceTimersByTimeAsync(0);
    expect(deps.commit.mock.calls.map((c) => c[0]!.map((v) => v.id))).toEqual([['a']]);
    await vi.advanceTimersByTimeAsync(UNDO_MS);
    expect(deps.commit.mock.calls.map((c) => c[0]!.map((v) => v.id))).toEqual([['a'], ['b']]);
  });

  it('undo after a new batch only restores the new batch', async () => {
    const { q, deps } = setup();
    q.remove(vids('a'));
    q.remove(vids('b'));
    q.undo();
    await vi.advanceTimersByTimeAsync(UNDO_MS);
    expect(deps.onRestore).toHaveBeenCalledWith(['b']);
    expect(deps.onRemoved).toHaveBeenCalledWith(['a']);
  });

  it('restores everything on total failure', async () => {
    const { q, deps } = setup(async (items) => ({ done: [], failed: items, error: new ApiError('http', 'x') }));
    q.remove(vids('a', 'b'));
    await vi.advanceTimersByTimeAsync(UNDO_MS);
    expect(deps.onRestore).toHaveBeenCalledWith(['a', 'b']);
    expect(deps.onFailed).toHaveBeenCalledTimes(1);
    expect(deps.onRemoved).not.toHaveBeenCalled();
  });

  it('partial failure restores only the failed items', async () => {
    const { q, deps } = setup(async (items) => ({ done: items.slice(0, 1), failed: items.slice(1), error: new ApiError('status', 'x') }));
    q.remove(vids('a', 'b', 'c'));
    await vi.advanceTimersByTimeAsync(UNDO_MS);
    expect(deps.onRemoved).toHaveBeenCalledWith(['a']);
    expect(deps.onRestore).toHaveBeenCalledWith(['b', 'c']);
  });

  it('reports progress, then clears it', async () => {
    const { q, deps } = setup(async (items, onProgress) => { onProgress(1, 2, items.slice(0, 1)); return allOk(items); });
    q.remove(vids('a', 'b'));
    await vi.advanceTimersByTimeAsync(UNDO_MS);
    expect(deps.onProgress.mock.calls.map((c) => c[0])).toEqual([{ done: 0, total: 2 }, { done: 1, total: 2 }, null]);
  });

  it('flush sends pending items with keepalive and cancels the timer', async () => {
    const { q, deps } = setup();
    q.remove(vids('a'));
    q.flush();
    expect(deps.commitKeepalive.mock.calls[0]![0].map((v) => v.id)).toEqual(['a']);
    expect(deps.onRemoved).toHaveBeenCalledWith(['a']);
    await vi.advanceTimersByTimeAsync(UNDO_MS);
    expect(deps.commit).not.toHaveBeenCalled();
  });

  it('flush during a commit only sends what is unconfirmed', async () => {
    let release = () => {};
    const { q, deps } = setup((items, onProgress) => new Promise((resolve) => {
      onProgress(1, 2, items.slice(0, 1));
      release = () => resolve(allOk(items));
    }));
    q.remove(vids('a', 'b'));
    await vi.advanceTimersByTimeAsync(UNDO_MS);
    q.flush();
    expect(deps.commitKeepalive.mock.calls[0]![0].map((v) => v.id)).toEqual(['b']);
    release();
  });

  it('flush hands back what did not fit', () => {
    const { q, deps } = setup(undefined, (items) => items.slice(1));
    q.remove(vids('a', 'b'));
    q.flush();
    expect(deps.onLeftover.mock.calls[0]![0].map((v: Video) => v.id)).toEqual(['b']);
    expect(deps.onRemoved).toHaveBeenCalledWith(['a']);
  });
  it('disposal abandons queued removals without sending them', async () => {
    const { q, deps } = setup();
    q.remove(vids('a'));
    q.commitNow();
    q.remove(vids('b'));
    q.dispose();
    await vi.advanceTimersByTimeAsync(UNDO_MS);
    q.flush();
    expect(deps.commit).not.toHaveBeenCalled();
    expect(deps.commitKeepalive).not.toHaveBeenCalled();
    expect(q.busy).toBe(false);
  });
});
