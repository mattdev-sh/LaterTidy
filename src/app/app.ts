import {
  addToPlaylist, ApiError, fetchTransport, listPlaylists, loadPlaylist, moveVideos, removeKeepalive,
  removeVideos, type LoadProgress, type Transport,
} from '../core/api';
import { parseBackup, toCsv, toJson } from '../core/backup';
import { pickBudget, type BudgetPick } from '../core/budget';
import { buildIndex, derive, emptyFilters, type Derived, type Filters, type SearchIndex } from '../core/filter';
import {
  addCategory, deleteCategory, emptyMeta, mergeMeta, restoreCategory, sanitizeMeta, setAssignment, setNote,
  updateCategory,
} from '../core/meta';
import { RemovalQueue } from '../core/removal';
import * as storage from '../core/storage';
import type { Category, Meta, PlaylistOption, Settings, Snapshot, Video, YtConfig } from '../core/types';
import { setLang, t, type Key } from '../i18n';

export type PopoverKind = 'sort' | 'settings' | 'help' | 'budget' | 'categories' | 'note' | 'playlist' | 'categoryEdit';

export interface Popover {
  kind: PopoverKind;
  anchor: { x: number; y: number; w: number; h: number } | null;
  ids?: string[];
  categoryId?: string;
}

export interface Toast {
  id: number; text: string; tone?: 'error';
  action?: { label: string; run: () => void };
  ttl: number; undo?: boolean;
}

export type Phase = 'boot' | 'loggedOut' | 'ready' | 'error';

export interface State {
  open: boolean; phase: Phase; errorWhy: string; theme: 'dark' | 'light';
  videos: Video[]; canReorder: boolean; isEditable: boolean; hasLoaded: boolean;
  refresh: { loaded: number; total: number | null } | null;
  hidden: ReadonlySet<string>;
  filters: Filters; settings: Settings;
  selection: ReadonlySet<string>; selectMode: boolean; anchorId: string | null; cursorId: string | null;
  popover: Popover | null; drawer: boolean; confirmRemove: 'dock' | 'bulk' | null;
  toasts: Toast[]; commit: { done: number; total: number } | null;
  meta: Meta;
  budget: { sec: number; pick: BudgetPick } | null;
  playlists: { forId: string; items: PlaylistOption[] | null; error: string | null } | null;
}

let toastSeq = 0;

const initialState = (): State => ({
    open: false, phase: 'boot', errorWhy: '', theme: 'dark',
    videos: [], canReorder: false, isEditable: true, hasLoaded: false,
    refresh: null, hidden: new Set(),
    filters: emptyFilters(), settings: { ...storage.DEFAULT_SETTINGS },
    selection: new Set(), selectMode: false, anchorId: null, cursorId: null,
    popover: null, drawer: false, confirmRemove: null,
    toasts: [], commit: null, meta: emptyMeta(), budget: null, playlists: null,
});

export class App {
  state = initialState();

  private listeners = new Set<() => void>();
  private cfg: YtConfig | null = null;
  private send: Transport | null = null;
  private acct = '';
  private startSeq = 0;
  private sessionAbort: AbortController | null = null;
  /** Changes only when switching accounts or signing out. Async UI work must keep its scope. */
  sessionVersion = 0;
  private refreshSeq = 0;
  private refreshAbort: AbortController | null = null;
  /** Ids confirmed gone since the running refresh began; its pages may still list them. */
  private tombstones = new Set<string>();
  private metaTimer: ReturnType<typeof setTimeout> | null = null;
  private confirmTimer: ReturnType<typeof setTimeout> | null = null;
  private indexFor: Video[] | null = null;
  private index: SearchIndex = new Map();
  private memo: { visible: Video[]; filters: Filters; meta: Meta; sort: string; out: Derived } | null = null;
  private visibleMemo: { videos: Video[]; hidden: ReadonlySet<string>; out: Video[] } | null = null;

  /** Exposed for host-level concerns: scroll lock, hash handling, focus. */
  onOpenChange: (open: boolean) => void = () => {};

  queue = this.createRemovalQueue();

  private createRemovalQueue() { return new RemovalQueue({
    commit: (items, onProgress) => removeVideos(this.send!, items, { onProgress }),
    commitKeepalive: (items) => {
      const base = new TextEncoder().encode(JSON.stringify({ context: this.cfg?.context ?? null, playlistId: 'WL', actions: [] })).byteLength;
      return removeKeepalive(this.send!, items, base);
    },
    onHide: (ids) => this.set({ hidden: union(this.state.hidden, ids), selection: without(this.state.selection, ids) }),
    onRestore: (ids) => this.set({ hidden: without(this.state.hidden, ids) }),
    onRemoved: (ids) => this.dropVideos(ids),
    onPending: () => {},
    onProgress: (commit) => this.set({ commit }),
    onFailed: (items, run) => {
      const why = t(`why.${run.error?.kind ?? 'network'}` as Key);
      this.toast({
        text: t('removeFailed', { n: items.length, why }), tone: 'error', ttl: 0,
        action: { label: t('retry'), run: () => this.removeNow(items) },
      });
    },
    onLeftover: (items) => { void storage.write(storage.pendingKey(this.acct), items.map((v) => v.setVideoId)); },
  }); }

  // ---- store ----
  set(patch: Partial<State>) {
    this.state = { ...this.state, ...patch };
    for (const l of this.listeners) l();
  }
  subscribe(l: () => void) { this.listeners.add(l); return () => { this.listeners.delete(l); }; }

  /** The list with pending removals taken out; original positions are untouched. */
  visible(): Video[] {
    const { videos, hidden } = this.state;
    const m = this.visibleMemo;
    if (m && m.videos === videos && m.hidden === hidden) return m.out;
    const out = hidden.size ? videos.filter((v) => !hidden.has(v.id)) : videos;
    this.visibleMemo = { videos, hidden, out };
    return out;
  }

  derived(): Derived {
    const visible = this.visible();
    const { filters, meta, settings: { sort } } = this.state;
    const m = this.memo;
    if (m && m.visible === visible && m.filters === filters && m.meta === meta && m.sort === sort) return m.out;
    if (this.indexFor !== this.state.videos) {
      this.index = buildIndex(this.state.videos);
      this.indexFor = this.state.videos;
    }
    const out = derive(visible, filters, meta, this.index, sort);
    this.memo = { visible, filters, meta, sort, out };
    return out;
  }

  // ---- lifecycle ----
  async start(cfg: YtConfig) {
    const seq = ++this.startSeq;
    setLang(cfg.hl);
    const fresh = !this.cfg || this.cfg.datasyncId !== cfg.datasyncId
      || this.cfg.sessionIndex !== cfg.sessionIndex || this.cfg.delegatedSessionId !== cfg.delegatedSessionId
      || this.cfg.loggedIn !== cfg.loggedIn;
    if (fresh) {
      this.flushMeta();
      this.refreshSeq++;
      this.refreshAbort?.abort();
      this.sessionAbort?.abort();
      this.queue.dispose();
      this.queue = this.createRemovalQueue();
      this.acct = '';
      this.tombstones.clear();
      this.sessionVersion++;
      if (this.confirmTimer) clearTimeout(this.confirmTimer);
      this.confirmTimer = null;
      const { open, theme } = this.state;
      this.set({ ...initialState(), open, theme });
      this.sessionAbort = new AbortController();
    }
    this.cfg = cfg;
    const transport = fetchTransport(cfg);
    const sessionSignal = this.sessionAbort!.signal;
    this.send = (path, body, init) => {
      if (sessionSignal.aborted) throw new DOMException('Aborted', 'AbortError');
      return transport(path, body, { ...init, signal: init?.signal ?? sessionSignal });
    };
    if (!cfg.loggedIn) { this.set({ phase: 'loggedOut' }); return; }
    if (!fresh && (this.state.hasLoaded || this.state.refresh)) {
      if (!this.state.refresh) this.refresh();
      return;
    }

    const acct = await storage.accountKey(cfg.datasyncId, cfg.sessionIndex);
    if (seq !== this.startSeq) return;
    this.acct = acct;
    const [snap, meta, settings] = await Promise.all([
      storage.readSnapshot(this.acct), storage.readMeta(this.acct), storage.readSettings(),
    ]);
    if (seq !== this.startSeq) return;
    this.set({ meta, settings, phase: 'ready' });
    if (snap) this.applySnapshot(snap);
    await this.resumeLeftovers();
    if (seq !== this.startSeq) return;
    this.refresh();
  }

  private applySnapshot(s: Snapshot) {
    this.set({ videos: s.videos, canReorder: s.canReorder, isEditable: s.isEditable, hasLoaded: true });
  }

  /** Pending removals that didn't fit the teardown keepalive budget finish here. */
  private async resumeLeftovers() {
    const session = this.sessionVersion;
    const key = storage.pendingKey(this.acct);
    const left = await storage.read<string[]>(key);
    if (session !== this.sessionVersion) return;
    if (!left?.length || !this.send) return;
    await storage.remove([key]);
    if (session !== this.sessionVersion) return;
    const set = new Set(left);
    const items = this.state.videos.filter((v) => set.has(v.setVideoId));
    if (items.length) {
      this.set({ hidden: union(this.state.hidden, items.map((v) => v.id)) });
      this.queue.remove(items);
      this.queue.commitNow();
    }
  }

  onStorageChange(key: string, value: unknown) {
    if (this.acct && key === storage.metaKey(this.acct) && !this.metaTimer) {
      this.set({ meta: sanitizeMeta(value) ?? emptyMeta() });
    } else if (key === storage.SETTINGS_KEY && value) {
      this.set({ settings: { ...storage.DEFAULT_SETTINGS, ...(value as Partial<Settings>) } });
    }
  }

  // ---- refresh ----
  refresh() {
    const send = this.send;
    if (!send) return;
    this.refreshAbort?.abort();
    const seq = ++this.refreshSeq;
    const abort = this.refreshAbort = new AbortController();
    if (!this.queue.busy) this.tombstones.clear();
    const cached = this.state.hasLoaded;
    const known = new Map(this.state.videos.map((v) => [v.id, v.firstSeenAt]));
    const fallbackTotal = this.state.videos.length || null;
    this.set({ refresh: { loaded: 0, total: fallbackTotal } });

    const onPage = (p: LoadProgress) => {
      if (seq !== this.refreshSeq) return;
      const patch: Partial<State> = { refresh: { loaded: p.videos.length, total: p.total ?? fallbackTotal } };
      if (!cached) {
        Object.assign(patch, { videos: this.alive([...p.videos]), canReorder: p.canReorder, isEditable: p.isEditable });
      }
      this.set(patch);
    };
    loadPlaylist(send, { known, signal: abort.signal, onPage }).then((result) => {
      if (seq !== this.refreshSeq) return;
      const videos = this.alive([...result.videos]);
      this.set({
        videos, canReorder: result.canReorder, isEditable: result.isEditable,
        hasLoaded: true, refresh: null, phase: 'ready',
      });
      this.saveSnapshot();
    }).catch((e) => {
      if (seq !== this.refreshSeq) return;
      if (e?.name === 'AbortError') { this.set({ refresh: null }); return; }
      const kind = e instanceof ApiError ? e.kind : 'parse';
      const why = t(`why.${kind}` as Key);
      if (this.state.videos.length) {
        this.set({ refresh: null, hasLoaded: true });
        this.toast({ text: t('refreshFailed', { why }), tone: 'error', ttl: 0, action: { label: t('retry'), run: () => this.refresh() } });
      } else {
        this.set({ refresh: null, phase: 'error', errorWhy: why });
      }
    });
  }

  cancelRefresh() {
    this.refreshSeq++;
    this.refreshAbort?.abort();
    this.set({ refresh: null, hasLoaded: this.state.hasLoaded || this.state.videos.length > 0 });
  }

  private alive(videos: Video[]) {
    return this.tombstones.size ? videos.filter((v) => !this.tombstones.has(v.id)) : videos;
  }

  private saveSnapshot() {
    const { videos, canReorder, isEditable } = this.state;
    const snap: Snapshot = { v: 1, savedAt: Date.now(), videos, canReorder, isEditable };
    void storage.write(storage.snapshotKey(this.acct), snap);
  }

  // ---- open state ----
  open() {
    if (this.state.open) return;
    this.set({ open: true });
    this.onOpenChange(true);
  }
  close() {
    if (!this.state.open) return;
    this.set({ open: false, popover: null, drawer: false, confirmRemove: null });
    this.onOpenChange(false);
  }

  // ---- filters ----
  setFilters(patch: Partial<Filters>) {
    this.set({ filters: { ...this.state.filters, ...patch }, confirmRemove: null });
  }
  clearFilters() { this.set({ filters: emptyFilters(), confirmRemove: null }); }

  updateSettings(patch: Partial<Settings>) {
    const settings = { ...this.state.settings, ...patch };
    this.set({ settings });
    void storage.write(storage.SETTINGS_KEY, settings);
  }

  // ---- selection ----
  toggleSelect(id: string, shift = false) {
    const view = this.derived().view;
    const next = new Set(this.state.selection);
    const anchor = this.state.anchorId;
    if (shift && anchor) {
      const a = view.findIndex((v) => v.id === anchor), b = view.findIndex((v) => v.id === id);
      if (a >= 0 && b >= 0) {
        const on = !next.has(id) || next.has(anchor);
        for (let i = Math.min(a, b); i <= Math.max(a, b); i++) {
          if (on) next.add(view[i]!.id); else next.delete(view[i]!.id);
        }
        this.set({ selection: next, anchorId: id, cursorId: id });
        return;
      }
    }
    if (next.has(id)) next.delete(id); else next.add(id);
    this.set({ selection: next, anchorId: id, cursorId: id, confirmRemove: null });
  }

  selectAll() {
    this.set({ selection: new Set(this.derived().view.map((v) => v.id)), selectMode: true, confirmRemove: null });
  }
  clearSelection() { this.set({ selection: new Set(), selectMode: false, anchorId: null, confirmRemove: null }); }

  private videosById(ids: Iterable<string>) {
    const set = new Set(ids);
    return this.state.videos.filter((v) => set.has(v.id));
  }

  // ---- removal ----
  private dropVideos(ids: string[]) {
    const set = new Set(ids);
    for (const id of ids) this.tombstones.add(id);
    this.set({
      videos: this.state.videos.filter((v) => !set.has(v.id)),
      hidden: without(this.state.hidden, ids),
    });
    if (!this.state.refresh) this.saveSnapshot();
  }

  /** Optimistic: hides now, commits after the undo window. */
  removeIds(ids: string[]) {
    // Removal is addressed by setVideoId; an item without one can't be sent.
    const items = this.videosById(ids).filter((v) => v.setVideoId);
    if (!items.length) return;
    this.queue.remove(items);
    const n = items.length;
    this.set({ confirmRemove: null });
    this.toast({
      text: t('removed', { n }), ttl: 8000, undo: true,
      action: { label: t('undo'), run: () => this.undoRemoval() },
    }, true);
  }

  private removeNow(items: Video[]) {
    this.queue.remove(items);
    this.queue.commitNow();
  }

  undoRemoval() {
    const n = this.queue.undo();
    this.dismissUndoToasts();
    return n;
  }

  private dismissUndoToasts() { this.set({ toasts: this.state.toasts.filter((x) => !x.undo) }); }

  /** Dock button, Remove all and keyboard all go through here so the ≥50 rule holds everywhere. */
  requestRemove(ids: string[], source: 'dock' | 'bulk') {
    if (ids.length >= 50 && this.state.confirmRemove !== source) {
      this.set({ confirmRemove: source });
      if (this.confirmTimer) clearTimeout(this.confirmTimer);
      this.confirmTimer = setTimeout(() => {
        if (this.state.confirmRemove === source) this.set({ confirmRemove: null });
      }, 6000);
      return;
    }
    this.removeIds(ids);
  }

  // ---- toasts ----
  toast(init: Omit<Toast, 'id'>, replaceUndo = false) {
    const id = ++toastSeq;
    const kept = replaceUndo ? this.state.toasts.filter((x) => !x.undo) : this.state.toasts;
    this.set({ toasts: [...kept, { ...init, id }].slice(-3) });
    if (init.ttl) setTimeout(() => this.dismissToast(id), init.ttl);
  }
  dismissToast(id: number) {
    if (this.state.toasts.some((x) => x.id === id)) {
      this.set({ toasts: this.state.toasts.filter((x) => x.id !== id) });
    }
  }
  /** `u`: the newest undoable toast. */
  undoLast() {
    const toast = [...this.state.toasts].reverse().find((x) => x.undo);
    toast?.action?.run();
  }

  // ---- playlists ----
  async openPlaylists(ids: string[], anchor: Popover['anchor']) {
    const session = this.sessionVersion;
    this.set({ popover: { kind: 'playlist', anchor, ids }, playlists: { forId: ids[0]!, items: null, error: null } });
    try {
      const items = await listPlaylists(this.send!, ids[0]!);
      if (session !== this.sessionVersion) return;
      if (this.state.popover?.kind === 'playlist') this.set({ playlists: { forId: ids[0]!, items, error: null } });
    } catch (e) {
      if (session !== this.sessionVersion) return;
      const why = t(`why.${e instanceof ApiError ? e.kind : 'network'}` as Key);
      if (this.state.popover?.kind === 'playlist') this.set({ playlists: { forId: ids[0]!, items: [], error: why } });
    }
  }

  async addTo(playlist: PlaylistOption, ids: string[], moveOut: boolean) {
    const session = this.sessionVersion;
    this.set({ popover: null });
    const run = await addToPlaylist(this.send!, playlist.id, this.videosById(ids));
    if (session !== this.sessionVersion) return;
    const name = playlist.title;
    if (run.done.length) {
      if (moveOut) this.removeIds(run.done.map((v) => v.id));
      else this.toast({ text: t('added', { n: run.done.length, name }), ttl: 4000 });
    }
    if (run.failed.length) {
      const why = t(`why.${run.error?.kind ?? 'network'}` as Key);
      this.toast({
        text: t('addFailed', { n: run.failed.length, name, why }), tone: 'error', ttl: 0,
        action: { label: t('retry'), run: () => void this.addTo(playlist, run.failed.map((v) => v.id), moveOut) },
      });
    }
  }

  async move(ids: string[], to: 'top' | 'bottom') {
    const session = this.sessionVersion;
    if (!this.state.canReorder) return;
    const items = this.videosById(ids);
    const run = await moveVideos(this.send!, items, to);
    if (session !== this.sessionVersion) return;
    if (run.done.length) {
      const moved = new Set(run.done.map((v) => v.id));
      const rest = this.state.videos.filter((v) => !moved.has(v.id));
      const block = this.state.videos.filter((v) => moved.has(v.id));
      this.set({ videos: to === 'top' ? [...block, ...rest] : [...rest, ...block] });
      this.saveSnapshot();
      this.toast({ text: t('moved', { n: run.done.length }), ttl: 4000 });
    }
    if (run.failed.length) {
      const why = t(`why.${run.error?.kind ?? 'network'}` as Key);
      this.toast({ text: t('moveFailed', { n: run.failed.length, why }), tone: 'error', ttl: 8000 });
    }
  }

  // ---- budget ----
  roll(sec: number) {
    const prev = this.state.budget?.sec === sec ? new Set(this.state.budget.pick.videos.map((v) => v.id)) : undefined;
    const pick = pickBudget(this.derived().view, sec, { previous: prev });
    this.set({ budget: { sec, pick } });
  }

  // ---- meta ----
  private commitMeta(meta: Meta) {
    this.set({ meta });
    if (this.metaTimer) clearTimeout(this.metaTimer);
    this.metaTimer = setTimeout(() => this.flushMeta(), 200);
  }

  flushMeta() {
    if (!this.metaTimer) return;
    clearTimeout(this.metaTimer);
    this.metaTimer = null;
    if (this.acct) void storage.write(storage.metaKey(this.acct), this.state.meta);
  }

  createCategory(name: string): Category {
    const { meta, category } = addCategory(this.state.meta, name);
    this.commitMeta(meta);
    return category;
  }
  assign(ids: string[], categoryId: string, on: boolean) {
    this.commitMeta(setAssignment(this.state.meta, ids, categoryId, on));
  }
  editCategory(id: string, patch: Partial<Omit<Category, 'id'>>) {
    this.commitMeta(updateCategory(this.state.meta, id, patch));
  }
  removeCategory(id: string) {
    const { meta, removed } = deleteCategory(this.state.meta, id);
    if (!removed) return;
    const categories = new Set(this.state.filters.categories);
    categories.delete(id);
    this.commitMeta(meta);
    this.setFilters({ categories });
    const undo = () => { this.commitMeta(restoreCategory(this.state.meta, removed)); this.dismissUndoToasts(); };
    this.toast({ text: t('categoryDeleted', { name: removed.category.name }), ttl: 8000, undo: true, action: { label: t('undo'), run: undo } });
  }
  saveNote(id: string, note: string) { this.commitMeta(setNote(this.state.meta, id, note)); }

  // ---- data ----
  download(kind: 'json' | 'csv', scope: 'view' | 'all') {
    const videos = scope === 'view' ? this.derived().view : this.visible();
    const text = kind === 'json' ? toJson(videos, this.state.meta) : toCsv(videos, this.state.meta);
    const type = kind === 'json' ? 'application/json' : 'text/csv;charset=utf-8';
    const url = URL.createObjectURL(new Blob([kind === 'csv' ? '﻿' + text : text], { type }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `latertidy-${new Date().toISOString().slice(0, 10)}.${kind}`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
  }

  async importBackup(file: File) {
    const session = this.sessionVersion;
    const incoming = parseBackup(await file.text());
    if (session !== this.sessionVersion) return;
    if (!incoming) { this.toast({ text: t('importBad'), tone: 'error', ttl: 6000 }); return; }
    const { meta, report } = mergeMeta(this.state.meta, incoming);
    this.commitMeta(meta);
    const skip = report.notesSkipped ? `. ${t('importSkip', { n: report.notesSkipped })}` : '';
    this.toast({ text: t('importOk', { c: report.categoriesAdded, a: report.assignmentsAdded, n: report.notesAdded }) + skip, ttl: 8000 });
  }

  async clearLocal() {
    if (this.metaTimer) { clearTimeout(this.metaTimer); this.metaTimer = null; }
    await storage.clearAll();
    this.set({ meta: emptyMeta(), filters: emptyFilters(), settings: { ...storage.DEFAULT_SETTINGS }, popover: null });
    this.toast({ text: t('cleared'), ttl: 4000 });
  }

  /** Teardown: nothing async survives this, so everything goes out synchronously. */
  pagehide() {
    this.flushMeta();
    this.queue.flush();
  }
  pageshow() {
    this.queue.revive();
    if (this.acct) void this.resumeLeftovers();
  }

}

function union(set: ReadonlySet<string>, ids: string[]): Set<string> {
  const next = new Set(set);
  for (const id of ids) next.add(id);
  return next;
}

function without(set: ReadonlySet<string>, ids: string[]): Set<string> {
  const next = new Set(set);
  for (const id of ids) next.delete(id);
  return next;
}
