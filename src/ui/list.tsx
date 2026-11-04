import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'preact/hooks';
import { firstHitIndex, terms as toTerms } from '../core/search';
import { remainingSec, statusOf } from '../core/time';
import type { Category, Video } from '../core/types';
import { fmtDur, t } from '../i18n';
import { anchorOf, Hl, useApp } from './shared';
import { IconAdd, IconBroken, IconCheck, IconNote, IconTag, IconTrash } from './icons';

const GRID_MIN = 248, GRID_GAP = 16, GRID_TEXT = 112, LIST_ROW = 108, PAD = 24, PAD_BOTTOM = 120;

export interface ListHandle { scrollTo(index: number): void; columns(): number }

function metaLine(v: Video): string {
  const status = statusOf(v);
  if (status === 'finished') return t('watched');
  if (v.live === 'live') return t('liveNow');
  if (v.live === 'upcoming') return t('upcoming');
  if (status === 'inProgress') return t('left', { t: fmtDur(remainingSec(v)) });
  return '';
}

function Check({ v, selected }: { v: Video; selected: boolean }) {
  const app = useApp();
  return (
    <button class={`check${selected ? ' on' : ''}`} role="checkbox" aria-checked={selected}
      aria-label={t('selectVideo', { title: v.title || v.id })}
      onClick={(e) => { e.preventDefault(); e.stopPropagation(); app.toggleSelect(v.id, e.shiftKey); }}>
      {selected && <IconCheck />}
    </button>
  );
}

function Quick({ v }: { v: Video }) {
  const app = useApp();
  const act = (fn: (el: EventTarget | null) => void) => (e: MouseEvent) => {
    e.preventDefault(); e.stopPropagation(); fn(e.currentTarget);
  };
  return (
    <div class="quick">
      {v.playable && <button class="q" aria-label={t('addToPlaylist')} title={t('addToPlaylist')} onClick={act((el) => void app.openPlaylists([v.id], anchorOf(el)))}><IconAdd /></button>}
      <button class="q" aria-label={t('pickCategories')} title={t('pickCategories')} onClick={act((el) => app.set({ popover: { kind: 'categories', ids: [v.id], anchor: anchorOf(el) } }))}><IconTag /></button>
      <button class="q" aria-label={t('note')} title={t('note')} onClick={act((el) => app.set({ popover: { kind: 'note', ids: [v.id], anchor: anchorOf(el) } }))}><IconNote /></button>
      <button class="q danger" aria-label={t('remove')} title={t('remove')} onClick={act(() => app.removeIds([v.id]))}><IconTrash /></button>
    </div>
  );
}

function Thumb({ v, selecting }: { v: Video; selecting: boolean }) {
  const app = useApp();
  const pct = v.watched ? 100 : v.pct;
  const label = v.live === 'live' ? t('liveNow') : v.live === 'upcoming' ? t('upcoming') : v.lengthText;
  const body = (
    <>
      {v.playable && v.thumb
        ? <img src={v.thumb} alt="" loading="lazy" decoding="async" draggable={false} />
        : <span class="thumb-empty"><IconBroken /></span>}
      {label && <span class={`badge${v.live ? ' live' : ''}`}>{label}</span>}
      {pct > 0 && <span class="resume"><i style={{ width: `${pct}%` }} /></span>}
    </>
  );
  if (!v.playable) return <div class="thumb">{body}</div>;
  return (
    <a class="thumb" href={`/watch?v=${v.id}&list=WL`} tabIndex={-1} aria-hidden="true"
      onClick={(e) => openClick(e, app, v, selecting)}>{body}</a>
  );
}

function openClick(e: MouseEvent, app: ReturnType<typeof useApp>, v: Video, selecting: boolean) {
  if (selecting && !e.metaKey && !e.ctrlKey) {
    e.preventDefault();
    app.toggleSelect(v.id, e.shiftKey);
    return;
  }
  // Plain clicks close; modified clicks open a tab and leave the overlay up.
  if (!e.metaKey && !e.ctrlKey && !e.shiftKey && e.button === 0) app.close();
}

function Dots({ categories }: { categories: Category[] }) {
  if (!categories.length) return null;
  const shown = categories.slice(0, 5);
  const label = categories.map((c) => t('categoryDot', { name: c.name })).join(', ');
  return (
    <span class="dots" role="img" aria-label={label} title={categories.map((c) => c.name).join(', ')}>
      {shown.map((c) => <span class="dot" key={c.id} style={{ background: c.color }} />)}
      {categories.length > 5 && <span class="dots-more">+{categories.length - 5}</span>}
    </span>
  );
}

function noteSnippet(note: string, terms: readonly string[]) {
  const flat = note.replace(/\s+/g, ' ');
  const at = firstHitIndex(flat, terms);
  return at > 24 ? '…' + flat.slice(at - 16) : flat;
}

interface ItemProps { v: Video; selected: boolean; selecting: boolean; cursor: boolean; terms: readonly string[]; cats: Category[]; note: string; pos: number; size: number; style: string }

function Card({ v, selected, selecting, cursor, terms, cats, note, pos, size, style }: ItemProps) {
  const app = useApp();
  const noteHit = terms.length > 0 && !!note && firstHitIndex(note, terms) >= 0;
  const line = metaLine(v);
  return (
    <div class={`card${selected ? ' selected' : ''}${cursor ? ' cursor' : ''}${selecting ? ' selecting' : ''}`} style={style}
      role="listitem" aria-posinset={pos} aria-setsize={size} data-id={v.id}>
      <div class="thumb-wrap">
        <Thumb v={v} selecting={selecting} />
        <Check v={v} selected={selected} />
        <Quick v={v} />
      </div>
      <h3 class="title">
        {v.playable
          ? <a href={`/watch?v=${v.id}&list=WL`} onClick={(e) => openClick(e, app, v, selecting)}><Hl text={v.title} terms={terms} /></a>
          : <span class="muted">{v.title || t('unavailableTitle')}</span>}
      </h3>
      <div class="sub">
        {v.channelUrl ? <a class="channel" href={v.channelUrl}><Hl text={v.channel} terms={terms} /></a> : <span class="channel"><Hl text={v.channel || t('unknownChannel')} terms={terms} /></span>}
      </div>
      {noteHit
        ? <div class="sub note-line"><IconNote /><span><Hl text={noteSnippet(note, terms)} terms={terms} /></span></div>
        : <div class="sub age">
            <span class="age-text">{v.ageRaw}</span>
            {line && <span class={`state${statusOf(v) === 'inProgress' ? ' accent' : ''}`}>{line}</span>}
            <span class="marks">
              <Dots categories={cats} />
              {note && <span class="note-mark" role="img" aria-label={t('hasNote')} title={note.slice(0, 120)}><IconNote /></span>}
            </span>
          </div>}
    </div>
  );
}

function Row({ v, selected, selecting, cursor, terms, cats, note, pos, size, style }: ItemProps) {
  const app = useApp();
  const rem = remainingSec(v);
  const line = metaLine(v);
  return (
    <div class={`line${selected ? ' selected' : ''}${cursor ? ' cursor' : ''}${selecting ? ' selecting' : ''}`} style={style}
      role="listitem" aria-posinset={pos} aria-setsize={size} data-id={v.id}>
      <Check v={v} selected={selected} />
      <div class="thumb-wrap"><Thumb v={v} selecting={selecting} /></div>
      <div class="line-text">
        <h3 class="title one">
          {v.playable
            ? <a href={`/watch?v=${v.id}&list=WL`} onClick={(e) => openClick(e, app, v, selecting)}><Hl text={v.title} terms={terms} /></a>
            : <span class="muted">{v.title || t('unavailableTitle')}</span>}
        </h3>
        <div class="sub line-sub">
          {v.channelUrl ? <a class="channel" href={v.channelUrl}><Hl text={v.channel} terms={terms} /></a> : <span class="channel"><Hl text={v.channel} terms={terms} /></span>}
          <span class="age-text">{v.ageRaw}</span>
          <Dots categories={cats} />
        </div>
        {note && <div class="sub note-line"><IconNote /><span><Hl text={noteSnippet(note, terms)} terms={terms} /></span></div>}
      </div>
      <div class="line-end">
        <span class="line-time">{rem ? fmtDur(rem) : ''}</span>
        {line && !line.startsWith(fmtDur(rem)) && <span class="state">{line}</span>}
      </div>
      <Quick v={v} />
    </div>
  );
}

export function VideoList({ view, handle }: { view: Video[]; handle: { current: ListHandle | null } }) {
  const app = useApp();
  const { settings, selection, selectMode, cursorId, meta, filters } = app.state;
  const scroller = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState({ w: 0, h: 0 });
  const [scrollTop, setScrollTop] = useState(0);

  useLayoutEffect(() => {
    const el = scroller.current!;
    const measure = () => setBox((b) => (b.w === el.clientWidth && b.h === el.clientHeight ? b : { w: el.clientWidth, h: el.clientHeight }));
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const grid = settings.view === 'grid';
  const inner = Math.max(0, box.w - PAD * 2);
  const cols = grid ? Math.max(1, Math.floor((inner + GRID_GAP) / (GRID_MIN + GRID_GAP))) : 1;
  const cardW = grid ? (inner - GRID_GAP * (cols - 1)) / cols : inner;
  const rowH = grid ? Math.round((cardW * 9) / 16) + GRID_TEXT : LIST_ROW;
  const rows = Math.ceil(view.length / cols);
  const total = rows * rowH + PAD_BOTTOM;

  const raf = useRef(0);
  const onScroll = useCallback(() => {
    if (raf.current) return;
    raf.current = requestAnimationFrame(() => {
      raf.current = 0;
      if (scroller.current) setScrollTop(scroller.current.scrollTop);
    });
  }, []);
  useEffect(() => () => cancelAnimationFrame(raf.current), []);

  handle.current = {
    columns: () => cols,
    scrollTo(index) {
      const el = scroller.current;
      if (!el) return;
      const top = Math.floor(index / cols) * rowH;
      if (top < el.scrollTop) el.scrollTop = top;
      else if (top + rowH > el.scrollTop + el.clientHeight - 96) el.scrollTop = top + rowH - el.clientHeight + 96;
    },
  };

  // A shrinking result set can leave the scroll offset past the end.
  useEffect(() => {
    const el = scroller.current;
    if (el && el.scrollTop > total) el.scrollTop = 0;
  }, [total]);

  const overscan = 2;
  const firstRow = Math.max(0, Math.floor(scrollTop / rowH) - overscan);
  const lastRow = Math.min(rows - 1, Math.ceil((scrollTop + box.h) / rowH) + overscan);
  const queryTerms = useMemo(() => toTerms(filters.query), [filters.query]);
  const catById = useMemo(() => new Map(meta.categories.map((c) => [c.id, c])), [meta.categories]);

  const selecting = selectMode || selection.size > 0;
  const items = [];
  if (box.w > 0) {
    for (let r = firstRow; r <= lastRow; r++) {
      for (let c = 0; c < cols; c++) {
        const i = r * cols + c;
        const v = view[i];
        if (!v) break;
        const m = meta.videos[v.id];
        const cats = (m?.categoryIds ?? []).map((id) => catById.get(id)).filter((x): x is Category => !!x);
        const x = grid ? PAD + c * (cardW + GRID_GAP) : PAD;
        const props: ItemProps = {
          v, selected: selection.has(v.id), selecting, cursor: cursorId === v.id, terms: queryTerms, cats, note: m?.note ?? '',
          pos: i + 1, size: view.length,
          style: `transform:translate(${x}px,${r * rowH}px);width:${cardW}px;height:${rowH}px`,
        };
        items.push(grid ? <Card key={v.id} {...props} /> : <Row key={v.id} {...props} />);
      }
    }
  }

  return (
    <div class="scroller" ref={scroller} onScroll={onScroll} role="list" aria-label={t('watchLater')} tabIndex={-1}>
      <div class="sizer" style={{ height: `${total}px` }}>{items}</div>
    </div>
  );
}
