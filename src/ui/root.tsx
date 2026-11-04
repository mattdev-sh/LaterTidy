import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'preact/hooks';
import type { App } from '../app/app';
import { isActivatable, isEditable, useKeyLayer, type KeyLayer } from '../app/keys';
import { filtersActive } from '../core/filter';
import { totalRemaining } from '../core/time';
import type { SortKey } from '../core/types';
import { heroTime, t, type Key } from '../i18n';
import { Dock } from './dock';
import { Histogram } from './histogram';
import { IconChevron, IconClose, IconFilter, IconGear, IconGrid, IconHelp, IconList, IconRefresh, IconSearch, IconTrash } from './icons';
import { VideoList, type ListHandle } from './list';
import { Popovers } from './popovers';
import { anchorOf, AppContext } from './shared';
import { Sidebar } from './sidebar';

const CHIPS = [{ label: '15m', sec: 900 }, { label: '30m', sec: 1800 }, { label: '1h', sec: 3600 }, { label: '2h', sec: 7200 }];

function Budget({ app }: { app: App }) {
  const [custom, setCustom] = useState('');
  const go = (sec: number, el: Element | null) => {
    app.roll(sec);
    app.set({ popover: { kind: 'budget', anchor: anchorOf(el) } });
  };
  const onKey = useCallback<KeyLayer>((e, target) => {
    if (e.key !== 'Enter' || !target.dataset?.budgetInput) return false;
    const min = Number((target as HTMLInputElement).value);
    if (min > 0) go(min * 60, target);
    return true;
  }, []);
  useKeyLayer(onKey);
  return (
    <div class="budget" role="group" aria-label={t('budget')}>
      <span class="budget-label">{t('budget')}</span>
      {CHIPS.map((c) => <button key={c.label} class="chip" data-budget={c.sec} onClick={(e) => go(c.sec, e.currentTarget)}>{c.label}</button>)}
      <input class="chip-input" type="number" min={1} max={1440} inputMode="numeric" placeholder={t('budgetCustom')} aria-label={t('budgetCustomLabel')}
        value={custom} data-budget-input="1" onInput={(e) => setCustom(e.currentTarget.value)} />
    </div>
  );
}

function Skeleton({ grid }: { grid: boolean }) {
  return (
    <div class={`skeleton ${grid ? 'grid' : 'list'}`} aria-hidden="true">
      {Array.from({ length: grid ? 12 : 8 }, (_, i) => <div key={i} class="sk"><i /><b /><u /></div>)}
    </div>
  );
}

function Message({ title, body, children }: { title: string; body: string; children?: preact.ComponentChildren }) {
  return <div class="message"><h2>{title}</h2><p>{body}</p><div class="message-actions">{children}</div></div>;
}

function Toasts({ app }: { app: App }) {
  const { toasts, commit } = app.state;
  return (
    <div class="toasts" role="status" aria-live="polite">
      {commit && (
        <div class="toast progress" data-toast="progress">
          <span>{t('removing', { done: commit.done, total: commit.total })}</span>
          <span class="toast-bar"><i style={{ width: `${(commit.done / commit.total) * 100}%` }} /></span>
        </div>
      )}
      {toasts.map((x) => (
        <div key={x.id} class={`toast${x.tone === 'error' ? ' error' : ''}`}>
          <span>{x.text}</span>
          {x.action && <button class="toast-action" onClick={() => { x.action!.run(); app.dismissToast(x.id); }}>{x.action.label}</button>}
          {x.tone === 'error' && <button class="mini" aria-label={t('close')} onClick={() => app.dismissToast(x.id)}><IconClose /></button>}
        </div>
      ))}
    </div>
  );
}

export function Root({ app }: { app: App }) {
  const [, setVersion] = useState(0);
  // Layout effect: state set right after mount must not fall in the gap before a passive effect.
  useLayoutEffect(() => {
    const bump = () => setVersion((n) => n + 1);
    const off = app.subscribe(bump);
    bump();
    return off;
  }, [app]);
  const s = app.state;
  const { view, facets } = app.derived();
  const list = useRef<ListHandle | null>(null);
  const search = useRef<HTMLInputElement>(null);
  const dialog = useRef<HTMLDivElement>(null);
  const prevOpen = useRef(false);

  useEffect(() => {
    if (s.open && !prevOpen.current) dialog.current?.focus();
    prevOpen.current = s.open;
  }, [s.open]);

  const moveCursor = (delta: number) => {
    const { view: v } = app.derived();
    if (!v.length) return;
    const at = v.findIndex((x) => x.id === app.state.cursorId);
    const next = at < 0 ? 0 : Math.max(0, Math.min(v.length - 1, at + delta));
    app.set({ cursorId: v[next]!.id });
    list.current?.scrollTo(next);
  };
  const targets = () => {
    const st = app.state;
    return st.selection.size ? [...st.selection] : st.cursorId ? [st.cursorId] : [];
  };
  const cursorAnchor = () => {
    const el = dialog.current?.querySelector(`[data-id="${app.state.cursorId}"]`);
    return anchorOf(el ?? null);
  };

  const onKey = useCallback<KeyLayer>((e, target) => {
    const st = app.state;
    if (e.key === 'Escape') {
      if (st.popover) app.set({ popover: null });
      else if (st.drawer) app.set({ drawer: false });
      else if (st.confirmRemove) app.set({ confirmRemove: null });
      else if (st.filters.query || target === search.current) {
        app.setFilters({ query: '' });
        search.current?.blur();
        dialog.current?.focus();
      } else if (isEditable(target)) {
        target.blur();
        dialog.current?.focus();
      } else if (st.selection.size || st.selectMode) app.clearSelection();
      else app.close();
      return true;
    }
    if (st.popover) return false;
    if (target === search.current && (e.key === 'Enter' || e.key === 'ArrowDown')) {
      search.current?.blur();
      dialog.current?.focus();
      moveCursor(0);
      return true;
    }
    if (isEditable(target) || e.metaKey || e.ctrlKey || e.altKey) return false;
    const cols = list.current?.columns() ?? 1;
    switch (e.key) {
      case '/': search.current?.focus(); search.current?.select(); return true;
      case 'j': moveCursor(1); return true;
      case 'k': moveCursor(-1); return true;
      case 'ArrowDown': if (isActivatable(target) && target.dataset.handle) return false; moveCursor(cols); return true;
      case 'ArrowUp': if (target.dataset.handle) return false; moveCursor(-cols); return true;
      case 'ArrowRight': if (target.dataset.handle) return false; moveCursor(1); return true;
      case 'ArrowLeft': if (target.dataset.handle) return false; moveCursor(-1); return true;
      case 'x': if (st.cursorId) app.toggleSelect(st.cursorId, e.shiftKey); return true;
      case 'X': if (st.cursorId) app.toggleSelect(st.cursorId, true); return true;
      case 'Enter': {
        if (isActivatable(target) || !st.cursorId) return false;
        app.close();
        location.href = `/watch?v=${st.cursorId}&list=WL`;
        return true;
      }
      case 'e': case 'Delete': {
        const ids = targets();
        if (!ids.length) return true;
        if (st.selection.size) app.requestRemove(ids, 'dock');
        else {
          const { view: v } = app.derived();
          const at = v.findIndex((x) => x.id === ids[0]);
          app.removeIds(ids);
          const after = app.derived().view;
          app.set({ cursorId: after[Math.min(at, after.length - 1)]?.id ?? null });
        }
        return true;
      }
      case 'u': app.undoLast(); return true;
      case 'b': {
        const el = dialog.current?.querySelector('.chip');
        app.roll(app.state.budget?.sec ?? 1800);
        app.set({ popover: { kind: 'budget', anchor: anchorOf(el ?? null) } });
        return true;
      }
      case 'g': app.updateSettings({ view: st.settings.view === 'grid' ? 'list' : 'grid' }); return true;
      case 'c': { const ids = targets(); if (ids.length) app.set({ popover: { kind: 'categories', ids, anchor: cursorAnchor() } }); return true; }
      case 'n': { const id = st.cursorId; if (id) app.set({ popover: { kind: 'note', ids: [id], anchor: cursorAnchor() } }); return true; }
      case '?': app.set({ popover: { kind: 'help', anchor: null } }); return true;
    }
    return false;
  }, []);
  useKeyLayer(onKey);

  // Enter in the sidebar's new-category input commits it by blurring.
  const onCreateKey = useCallback<KeyLayer>((e, target) => {
    if (e.key === 'Enter' && target.dataset?.createCategory !== undefined) { target.blur(); return true; }
    return false;
  }, []);
  useKeyLayer(onCreateKey);

  const remaining = useMemo(() => totalRemaining(view), [view]);
  const hero = heroTime(remaining);

  const visibleCount = app.visible().length;
  const sf = s.filters.status;
  const suggestRemove = (sf === 'finished' || sf === 'unavailable') && view.length > 0;
  const allSelected = view.length > 0 && view.every((v) => s.selection.has(v.id));

  const body = () => {
    if (s.phase === 'loggedOut') {
      const url = `https://accounts.google.com/ServiceLogin?service=youtube&continue=${encodeURIComponent(location.href)}`;
      return <Message title={t('loggedOutTitle')} body={t('loggedOutBody')}><a class="btn primary" href={url}>{t('signIn')}</a></Message>;
    }
    if (s.phase === 'error') {
      return (
        <Message title={t('errorTitle')} body={t('errorBody', { why: s.errorWhy })}>
          <button class="btn primary" onClick={() => { app.set({ phase: 'ready' }); app.refresh(); }}>{t('retry')}</button>
          <button class="btn" onClick={() => app.close()}>{t('classicView')}</button>
        </Message>
      );
    }
    if (!s.videos.length && (s.phase === 'boot' || s.refresh)) return <Skeleton grid={s.settings.view === 'grid'} />;
    if (!visibleCount) return <Message title={t('emptyTitle')} body={t('emptyBody')} />;
    if (!view.length) {
      return <Message title={t('noMatchTitle')} body={t('noMatchBody')}><button class="btn primary" onClick={() => app.clearFilters()}>{t('clearFilters')}</button></Message>;
    }
    return <VideoList view={view} handle={list} />;
  };

  const ready = s.phase === 'ready' || s.phase === 'boot';

  return (
    <AppContext.Provider value={app}>
      <div ref={dialog} class="overlay" role="dialog" aria-modal="true" aria-label={t('dialogLabel')} tabIndex={-1} data-open={s.open}>
        <div class={`shell${s.drawer ? ' drawer-open' : ''}`}>
          {ready && <div class="drawer-scrim" onClick={() => app.set({ drawer: false })} />}
          {ready && <Sidebar facets={facets} />}
          <main class="main">
            <header class="topbar">
              {!ready && <span class="wordmark">LaterTidy</span>}
              {ready && <>
              <button class="icon drawer-btn" aria-label={t('openFilters')} title={t('openFilters')} onClick={() => app.set({ drawer: true })}><IconFilter /></button>
              <label class="searchbox">
                <IconSearch />
                <input ref={search} type="search" placeholder={t('search')} aria-label={t('search')} value={s.filters.query} spellcheck={false}
                  onInput={(e) => app.setFilters({ query: e.currentTarget.value })} />
                <kbd>/</kbd>
              </label>
              <button class="btn ghost sort-btn" aria-haspopup="menu" onClick={(e) => app.set({ popover: { kind: 'sort', anchor: anchorOf(e.currentTarget) } })}>
                <span>{t(`sort.${s.settings.sort as SortKey}` as Key)}</span><IconChevron />
              </button>
              <div class="seg" role="group" aria-label={t('sort')}>
                <button aria-label={t('gridView')} title={t('gridView')} aria-pressed={s.settings.view === 'grid'} onClick={() => app.updateSettings({ view: 'grid' })}><IconGrid /></button>
                <button aria-label={t('listView')} title={t('listView')} aria-pressed={s.settings.view === 'list'} onClick={() => app.updateSettings({ view: 'list' })}><IconList /></button>
              </div>
              <div class="tools">
                <button class="icon hide-s" aria-label={t('refresh')} title={t('refresh')} disabled={!!s.refresh} onClick={() => app.refresh()}><IconRefresh /></button>
                <button class="icon hide-s" aria-label={t('help')} title={t('help')} onClick={() => app.set({ popover: { kind: 'help', anchor: null } })}><IconHelp /></button>
                <button class="icon" aria-label={t('settings')} title={t('settings')} onClick={(e) => app.set({ popover: { kind: 'settings', anchor: anchorOf(e.currentTarget) } })}><IconGear /></button>
                <button class="btn ghost classic" title={t('classicView')} onClick={() => app.close()}><IconClose /><span>{t('classicView')}</span></button>
              </div>
              </>}
              {s.phase === 'loggedOut' && <button class="btn ghost classic push" title={t('classicView')} onClick={() => app.close()}><IconClose /><span>{t('classicView')}</span></button>}
            </header>
            {s.refresh && (
              <div class="sync" role="status">
                <span class="sync-bar"><i style={{ width: s.refresh.total ? `${Math.min(100, (s.refresh.loaded / s.refresh.total) * 100)}%` : '30%' }} /></span>
                <span class="sync-text">{s.refresh.total ? t('syncing', { a: s.refresh.loaded, b: Math.max(s.refresh.total, s.refresh.loaded) }) : t('syncingCount', { a: s.refresh.loaded })}</span>
                <button class="mini" aria-label={t('cancelRefresh')} title={t('cancelRefresh')} onClick={() => app.cancelRefresh()}><IconClose /></button>
              </div>
            )}
            {ready && (
              <section class="hero">
                <div class="big"><span class="big-n">{hero.value}</span> <span class="big-u">{hero.unit}</span></div>
                <div class="hero-right">
                  <Histogram bars={facets.histogram} />
                </div>
                <div class="count">{t('videoCount', { n: view.length })}</div>
                <Budget app={app} />
              </section>
            )}
            {ready && s.videos.length > 0 && (
              <div class="listbar">
                <label class={`select-all${view.length ? '' : ' off'}`}>
                  <input type="checkbox" checked={allSelected} disabled={!view.length}
                    onChange={() => (allSelected ? app.clearSelection() : app.selectAll())} />
                  <span>{t('selectAll', { n: view.length })}</span>
                </label>
                <button class="btn ghost small" aria-pressed={s.selectMode} onClick={() => (s.selectMode ? app.clearSelection() : app.set({ selectMode: true }))}>
                  {s.selectMode ? t('selectDone') : t('select')}
                </button>
                {filtersActive(s.filters) && <button class="link" onClick={() => app.clearFilters()}>{t('clearFilters')}</button>}
                {suggestRemove && (
                  <button class={`btn danger small suggest${s.confirmRemove === 'bulk' ? ' armed' : ''}`} data-action="remove-all"
                    onClick={() => app.requestRemove(view.map((v) => v.id), 'bulk')}>
                    <IconTrash />{s.confirmRemove === 'bulk' ? t('confirmRemove', { n: view.length }) : t('removeAll', { n: view.length })}
                  </button>
                )}
              </div>
            )}
            <div class="body">{body()}</div>
            <Dock />
          </main>
        </div>
        <Toasts app={app} />
        <Popovers />
      </div>
    </AppContext.Provider>
  );
}
