import type { ComponentChildren } from 'preact';
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'preact/hooks';
import type { Popover } from '../app/app';
import { useKeyLayer, type KeyLayer } from '../app/keys';
import { queueUrl } from '../core/budget';
import { findCategoryByName, NOTE_MAX, PALETTE } from '../core/meta';
import { fold } from '../core/search';
import { remainingSec } from '../core/time';
import type { SortKey } from '../core/types';
import { fmtDur, num, t, type Key } from '../i18n';
import { useApp } from './shared';
import { IconCheck, IconClose, IconMinus, IconPlay, IconTrash } from './icons';


/** Anchored panel, clamped to the viewport; a bottom sheet on phones. */
function Panel({ popover, width, label, children, modal }: {
  popover: Popover; width: number; label: string; children: ComponentChildren; modal?: boolean;
}) {
  const app = useApp();
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);
  const sheet = window.innerWidth < 600;

  // Content can grow after opening (playlists load late), so placement follows the panel's size.
  useLayoutEffect(() => {
    const el = ref.current!;
    const place = () => {
      const a = popover.anchor;
      const h = el.offsetHeight;
      const vw = window.innerWidth, vh = window.innerHeight;
      if (modal || !a) { setPos({ left: (vw - width) / 2, top: Math.max(16, (vh - h) / 2) }); return; }
      const left = Math.max(12, Math.min(a.x + a.w - width, vw - width - 12));
      const below = a.y + a.h + 8;
      const top = below + h <= vh - 12 ? below : Math.max(12, a.y - h - 8);
      setPos({ left, top });
    };
    place();
    const ro = new ResizeObserver(place);
    ro.observe(el);
    return () => ro.disconnect();
  }, [popover.anchor, width, modal]);

  useLayoutEffect(() => {
    const prev = (ref.current?.getRootNode() as ShadowRoot).activeElement as HTMLElement | null;
    const el = ref.current!;
    const first = el.querySelector<HTMLElement>('[data-autofocus]') ?? el.querySelector<HTMLElement>('input,textarea,button');
    first?.focus();
    return () => prev?.isConnected && prev.focus();
  }, []);

  const onKey = useCallback<KeyLayer>((e, target) => {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return false;
    if (target.tagName === 'TEXTAREA') return false;
    const items = [...ref.current!.querySelectorAll<HTMLElement>('[data-item]')];
    if (!items.length) return false;
    const at = items.indexOf(target);
    const next = at < 0 ? 0 : (at + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length;
    items[next]!.focus();
    return true;
  }, []);
  useKeyLayer(onKey);

  return (
    <>
      <div class="scrim" onClick={() => app.set({ popover: null })} />
      <div ref={ref} data-popover class={`popover${sheet ? ' sheet' : ''}`} role="dialog" aria-label={label}
        style={sheet ? undefined : { width: `${width}px`, left: `${pos?.left ?? -9999}px`, top: `${pos?.top ?? 0}px` }}>
        {children}
      </div>
    </>
  );
}

const SORTS: SortKey[] = ['youtube', 'reverse', 'shortest', 'longest', 'leastRemaining', 'channel', 'newest', 'oldest'];

function SortMenu({ popover }: { popover: Popover }) {
  const app = useApp();
  const cur = app.state.settings.sort;
  return (
    <Panel popover={popover} width={240} label={t('sort')}>
      <div role="menu">
        {SORTS.map((s) => (
          <button key={s} role="menuitemradio" aria-checked={cur === s} class="menu-item" data-item data-autofocus={cur === s ? true : undefined}
            onClick={() => { app.updateSettings({ sort: s }); app.set({ popover: null }); }}>
            <span>{t(`sort.${s}` as Key)}</span>{cur === s && <IconCheck />}
          </button>
        ))}
      </div>
    </Panel>
  );
}

function CategoryPicker({ popover }: { popover: Popover }) {
  const app = useApp();
  const ids = popover.ids ?? [];
  const { meta } = app.state;
  const [q, setQ] = useState('');
  const folded = fold(q.trim());
  const list = meta.categories.filter((c) => !folded || fold(c.name).includes(folded));
  const exact = q.trim() ? findCategoryByName(meta, q) : undefined;

  const stateOf = (cid: string) => {
    const n = ids.filter((id) => meta.videos[id]?.categoryIds.includes(cid)).length;
    return n === 0 ? false : n === ids.length ? true : 'mixed';
  };
  const toggle = (cid: string) => app.assign(ids, cid, stateOf(cid) !== true);
  const create = () => {
    const c = app.createCategory(q);
    app.assign(ids, c.id, true);
    setQ('');
  };

  const onKey = useCallback<KeyLayer>((e, target) => {
    if (e.key === 'Enter' && target.tagName === 'INPUT' && q.trim()) {
      if (exact) toggle(exact.id); else create();
      setQ('');
      return true;
    }
    return false;
  }, [q, exact, ids]);
  useKeyLayer(onKey);

  return (
    <Panel popover={popover} width={280} label={t('pickCategories')}>
      <input class="field" placeholder={t('categoryFilter')} aria-label={t('categoryFilter')} maxLength={40} value={q} data-autofocus
        onInput={(e) => setQ(e.currentTarget.value)} />
      <div class="pick-list" role="group" aria-label={t('pickCategories')}>
        {list.map((c) => {
          const s = stateOf(c.id);
          return (
            <button key={c.id} class="menu-item pick" role="checkbox" aria-checked={s} data-item onClick={() => toggle(c.id)}>
              <span class={`box${s ? ' on' : ''}`}>{s === true ? <IconCheck /> : s === 'mixed' ? <IconMinus /> : null}</span>
              <span class="dot" style={{ background: c.color }} />
              <span class="row-label">{c.name}</span>
            </button>
          );
        })}
        {q.trim() && !exact && (
          <button class="menu-item create" data-item onClick={create}>{t('createCategory', { name: q.trim() })}</button>
        )}
        {!q.trim() && !list.length && <p class="hint pad">{t('noCategories')}</p>}
      </div>
    </Panel>
  );
}

function CategoryEdit({ popover }: { popover: Popover }) {
  const app = useApp();
  const c = app.state.meta.categories.find((x) => x.id === popover.categoryId);
  useKeyLayer((e, target) => {
    if (e.key !== 'Enter' || target.dataset?.rename === undefined || !c) return false;
    app.editCategory(c.id, { name: (target as HTMLInputElement).value });
    app.set({ popover: null });
    return true;
  });
  if (!c) return null;
  return (
    <Panel popover={popover} width={260} label={t('editCategory', { name: c.name })}>
      <div class="form">
        <label class="label">{t('rename')}
          <input class="field" value={c.name} maxLength={40} data-autofocus data-rename
            onChange={(e) => app.editCategory(c.id, { name: e.currentTarget.value })} />
        </label>
        <div class="label" id="lb-color">{t('color')}</div>
        <div class="swatches" role="radiogroup" aria-labelledby="lb-color">
          {PALETTE.map((color, i) => (
            <button key={color} class={`swatch${color === c.color ? ' on' : ''}`} role="radio" aria-checked={color === c.color} aria-label={`${t('color')} ${i + 1}`}
              style={{ background: color }} onClick={() => app.editCategory(c.id, { color })} />
          ))}
        </div>
        <button class="btn danger wide" onClick={() => { app.set({ popover: null }); app.removeCategory(c.id); }}><IconTrash />{t('deleteCategory')}</button>
        <p class="hint">{t('deleteCategoryNote')}</p>
      </div>
    </Panel>
  );
}

function NoteEditor({ popover }: { popover: Popover }) {
  const app = useApp();
  const id = popover.ids![0]!;
  const video = app.state.videos.find((v) => v.id === id);
  const initial = app.state.meta.videos[id]?.note ?? '';
  const session = useRef(app.sessionVersion).current;
  const [text, setText] = useState(initial);
  const latest = useRef(text);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => () => {
    clearTimeout(timer.current);
    if (session === app.sessionVersion) app.saveNote(id, latest.current);
  }, [id]);

  const onKey = useCallback<KeyLayer>((e) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { app.set({ popover: null }); return true; }
    return false;
  }, []);
  useKeyLayer(onKey);

  return (
    <Panel popover={popover} width={380} label={t('editNote', { title: video?.title ?? id })}>
      <div class="form">
        <div class="note-title">{video?.title}</div>
        <textarea class="field area" rows={6} maxLength={NOTE_MAX} placeholder={t('notePlaceholder')} aria-label={t('note')} value={text} data-autofocus
          onInput={(e) => {
            const value = e.currentTarget.value;
            latest.current = value;
            setText(value);
            clearTimeout(timer.current);
            timer.current = setTimeout(() => {
              if (session === app.sessionVersion) app.saveNote(id, value);
            }, 400);
          }} />
        <div class="note-foot">
          <span class="hint">{text.length > NOTE_MAX - 200 ? `${num(text.length)} / ${num(NOTE_MAX)}` : t('noteHint')}</span>
          <button class="btn primary" onClick={() => app.set({ popover: null })}>{t('noteDone')}</button>
        </div>
      </div>
    </Panel>
  );
}

function PlaylistPicker({ popover }: { popover: Popover }) {
  const app = useApp();
  const ids = popover.ids ?? [];
  const data = app.state.playlists;
  const [moveOut, setMoveOut] = useState(false);
  return (
    <Panel popover={popover} width={320} label={t('addToPlaylist')}>
      <div class="pop-title">{t('addToPlaylist')}</div>
      <div class="pick-list">
        {!data?.items && <p class="hint pad">{t('loadingPlaylists')}</p>}
        {data?.error && <p class="hint pad">{data.error}</p>}
        {data?.items?.length === 0 && !data.error && <p class="hint pad">{t('noPlaylists')}</p>}
        {data?.items?.map((p) => (
          <button key={p.id} class="menu-item playlist" data-item onClick={() => void app.addTo(p, ids, moveOut)}>
            <span class="row-label">{p.title}</span>
            <span class="muted-s">{p.containsSelected && ids.length === 1 ? t('alreadyIn') : t(`privacy.${p.privacy}` as Key) ?? ''}</span>
          </button>
        ))}
      </div>
      <label class="switch-row">
        <input type="checkbox" checked={moveOut} onChange={(e) => setMoveOut(e.currentTarget.checked)} />
        <span>{t('moveOut')}</span>
      </label>
    </Panel>
  );
}

function BudgetPanel({ popover }: { popover: Popover }) {
  const app = useApp();
  const b = app.state.budget;
  if (!b) return null;
  const ids = b.pick.videos.map((v) => v.id);
  return (
    <Panel popover={popover} width={400} label={t('budgetTitle', { t: fmtDur(b.sec) })}>
      <div class="pop-title">{t('budgetTitle', { t: fmtDur(b.sec) })}</div>
      {ids.length === 0
        ? <p class="hint pad">{t('budgetEmpty', { t: fmtDur(b.sec) })}</p>
        : <>
            <ol class="budget-list">
              {b.pick.videos.map((v) => (
                <li key={v.id}>
                  <span class="b-title">{v.title}</span>
                  <span class="b-time">{fmtDur(remainingSec(v))}</span>
                </li>
              ))}
            </ol>
            <div class="budget-foot">
              <span class="budget-total">{t('budgetTotal', { n: t('videoCount', { n: ids.length }), t: fmtDur(b.pick.total) })}</span>
              <button class="btn" onClick={() => app.roll(b.sec)}>{t('anotherPick')}</button>
              <a class="btn primary" href={queueUrl(ids)} data-autofocus data-action="budget-play"><IconPlay />{t('play')}</a>
            </div>
          </>}
    </Panel>
  );
}

function SettingsPanel({ popover }: { popover: Popover }) {
  const app = useApp();
  const { settings } = app.state;
  const [armed, setArmed] = useState(false);
  const file = useRef<HTMLInputElement>(null);
  return (
    <Panel popover={popover} width={340} label={t('settings')}>
      <div class="form">
        <label class="switch-row flush">
          <input type="checkbox" checked={settings.autoOpen} data-autofocus onChange={(e) => app.updateSettings({ autoOpen: e.currentTarget.checked })} />
          <span>{t('autoOpen')}</span>
        </label>
        <div class="label">{t('exportData')}</div>
        <div class="export-grid">
          <span>{t('exportView')}</span>
          <button class="btn small" data-export="view-json" onClick={() => app.download('json', 'view')}>{t('exportJson')}</button>
          <button class="btn small" data-export="view-csv" onClick={() => app.download('csv', 'view')}>{t('exportCsv')}</button>
          <span>{t('exportAll')}</span>
          <button class="btn small" data-export="all-json" onClick={() => app.download('json', 'all')}>{t('exportJson')}</button>
          <button class="btn small" data-export="all-csv" onClick={() => app.download('csv', 'all')}>{t('exportCsv')}</button>
        </div>
        <button class="btn wide" onClick={() => file.current?.click()}>{t('importBackup')}</button>
        <input ref={file} type="file" accept="application/json,.json" hidden data-import
          onChange={(e) => {
            const f = e.currentTarget.files?.[0];
            e.currentTarget.value = '';
            if (f) { app.set({ popover: null }); void app.importBackup(f); }
          }} />
        <p class="hint">{t('localNote')}</p>
        <button class={`btn danger wide${armed ? ' armed' : ''}`} onClick={() => { if (armed) void app.clearLocal(); else setArmed(true); }}>
          {armed ? t('clearDataConfirm') : t('clearData')}
        </button>
        {armed && <p class="hint">{t('clearDataNote')}</p>}
        <p class="hint foot">{t('version', { v: chrome.runtime?.getManifest?.().version ?? '' })}<br />{t('disclaimer')}</p>
      </div>
    </Panel>
  );
}

const KEYS: Array<[string, Key]> = [
  ['/', 'key.search'], ['j k', 'key.move'], ['x', 'key.select'], ['Enter', 'key.open'], ['e', 'key.remove'], ['u', 'key.undo'],
  ['c', 'key.category'], ['n', 'key.note'], ['b', 'key.budget'], ['g', 'key.view'], ['?', 'key.help'], ['Esc', 'key.esc'],
];

function HelpPanel({ popover }: { popover: Popover }) {
  const app = useApp();
  return (
    <Panel popover={popover} width={440} label={t('helpTitle')} modal>
      <div class="pop-head">
        <div class="pop-title">{t('helpTitle')}</div>
        <button class="icon" aria-label={t('close')} data-autofocus onClick={() => app.set({ popover: null })}><IconClose /></button>
      </div>
      <dl class="keys">
        {KEYS.map(([k, label]) => (
          <div key={k}><dt>{k.split(' ').map((p) => <kbd>{p}</kbd>)}</dt><dd>{t(label)}</dd></div>
        ))}
      </dl>
    </Panel>
  );
}

export function Popovers() {
  const app = useApp();
  const p = app.state.popover;
  if (!p) return null;
  const key = `${p.kind}:${p.ids?.[0] ?? p.categoryId ?? ''}`;
  switch (p.kind) {
    case 'sort': return <SortMenu key={key} popover={p} />;
    case 'categories': return <CategoryPicker key={key} popover={p} />;
    case 'categoryEdit': return <CategoryEdit key={key} popover={p} />;
    case 'note': return <NoteEditor key={key} popover={p} />;
    case 'playlist': return <PlaylistPicker key={key} popover={p} />;
    case 'budget': return <BudgetPanel key={key} popover={p} />;
    case 'settings': return <SettingsPanel key={key} popover={p} />;
    case 'help': return <HelpPanel key={key} popover={p} />;
    default: return null;
  }
}
