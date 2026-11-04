import type { ChunkRun } from './api';
import type { Video } from './types';

export const UNDO_MS = 8000;

export interface RemovalDeps {
  /** Sequential, chunked network commit. Must never reject. */
  commit(items: Video[], onProgress: (done: number, total: number, settled: Video[]) => void): Promise<ChunkRun<Video>>;
  /** Fire-and-forget commit that survives page teardown. Returns what could not be sent. */
  commitKeepalive(items: Video[]): Video[];
  /** Items stay hidden from the list while pending or being sent. */
  onHide(ids: string[]): void;
  /** Items return to the list at their original position. */
  onRestore(ids: string[]): void;
  /** Items are gone from YouTube. */
  onRemoved(ids: string[]): void;
  onPending(count: number): void;
  onProgress(state: { done: number; total: number } | null): void;
  onFailed(items: Video[], run: ChunkRun<Video>): void;
  /** Called on teardown with items that could not be flushed. */
  onLeftover(items: Video[]): void;
  delayMs?: number;
}

/**
 * Deferred removal. Nothing goes on the network until the undo window ends: a new batch, or
 * leaving the page, ends it early. Commits run one at a time, in order.
 */
export class RemovalQueue {
  private pending: Video[] = [];
  private timer: ReturnType<typeof setTimeout> | null = null;
  private tail: Promise<void> = Promise.resolve();
  /** Items handed to a commit whose request may not have been sent yet. */
  private unsent = new Map<string, Video>();
  private dead = false;

  constructor(private deps: RemovalDeps) {}

  get pendingCount() { return this.pending.length; }
  get busy() { return this.unsent.size > 0 || this.pending.length > 0; }

  remove(items: Video[]) {
    if (this.dead || !items.length) return;
    this.commitNow();
    this.pending = items;
    this.deps.onHide(items.map((v) => v.id));
    this.deps.onPending(items.length);
    this.timer = setTimeout(() => this.commitNow(), this.deps.delayMs ?? UNDO_MS);
  }

  /** Restores the pending batch. Returns the count restored; nothing has been sent. */
  undo(): number {
    if (!this.pending.length) return 0;
    this.clearTimer();
    const items = this.pending;
    this.pending = [];
    this.deps.onRestore(items.map((v) => v.id));
    this.deps.onPending(0);
    return items.length;
  }

  commitNow() {
    this.clearTimer();
    const items = this.pending;
    if (!items.length) return;
    this.pending = [];
    this.deps.onPending(0);
    for (const v of items) this.unsent.set(v.id, v);
    this.tail = this.tail.then(() => this.run(items));
  }

  private async run(items: Video[]) {
    if (this.dead) return;
    this.deps.onProgress({ done: 0, total: items.length });
    const result = await this.deps.commit(items, (done, total, settled) => {
      for (const v of settled) this.unsent.delete(v.id);
      if (!this.dead) this.deps.onProgress({ done, total });
    });
    for (const v of items) this.unsent.delete(v.id);
    if (this.dead) return;
    this.deps.onProgress(null);
    if (result.done.length) this.deps.onRemoved(result.done.map((v) => v.id));
    if (result.failed.length) {
      this.deps.onRestore(result.failed.map((v) => v.id));
      this.deps.onFailed(result.failed, result);
    }
  }

  private clearTimer() {
    if (this.timer !== null) clearTimeout(this.timer);
    this.timer = null;
  }

  /** On pagehide: everything not yet confirmed is sent with keepalive. */
  flush() {
    if (this.dead) return;
    this.dead = true;
    this.clearTimer();
    const items = [...this.unsent.values(), ...this.pending];
    this.pending = [];
    this.unsent.clear();
    if (!items.length) return;
    const left = this.deps.commitKeepalive(items);
    const kept = new Set(left.map((v) => v.id));
    this.deps.onRemoved(items.filter((v) => !kept.has(v.id)).map((v) => v.id));
    if (left.length) this.deps.onLeftover(left);
  }

  /** The page came back from bfcache: accept work again. */
  revive() { this.dead = false; }

  /** Abandon this account's queue without sending pending removals to a new session. */
  dispose() {
    this.dead = true;
    this.clearTimer();
    this.pending = [];
    this.unsent.clear();
  }
}
