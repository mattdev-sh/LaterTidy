import { useCallback, useMemo, useState } from 'preact/hooks';
import { useKeyLayer, type KeyLayer } from '../app/keys';
import type { Facets, StatusFilter } from '../core/filter';
import { UNCATEGORIZED } from '../core/filter';
import { fold } from '../core/search';
import { num, t, type Key } from '../i18n';
import { anchorOf, useApp } from './shared';
import { IconClose, IconMore, IconPlus } from './icons';

const STATUSES: StatusFilter[] = ['all', 'notStarted', 'inProgress', 'finished', 'unavailable', 'live'];

function Row(props: { label: string; count: number; active: boolean; onClick: () => void; dot?: string; check?: boolean; title?: string }) {
  return (
    <button class={`row${props.active ? ' active' : ''}`} aria-pressed={props.active} onClick={props.onClick} title={props.title}>
      {props.dot && <span class="dot" style={{ background: props.dot }} />}
      <span class="row-label">{props.label}</span>
      <span class="row-count">{num(props.count)}</span>
    </button>
  );
}

const CHANNEL_CAP = 60;

export function Sidebar({ facets }: { facets: Facets }) {
  const app = useApp();
  const { filters, meta } = app.state;
  const [q, setQ] = useState('');
  const [showAll, setShowAll] = useState(false);
  const [creating, setCreating] = useState(false);

  const channels = useMemo(() => {
    const folded = fold(q.trim());
    const list = [...facets.channels.entries()]
      .map(([key, c]) => ({ key, ...c }))
      .filter((c) => !folded || fold(c.name).includes(folded) || filters.channels.has(c.key))
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
    return list;
  }, [facets.channels, q, filters.channels]);
  const onKey = useCallback<KeyLayer>((e, target) => {
    if (e.key !== 'Escape' || target.dataset?.channelSearch === undefined || !(target as HTMLInputElement).value) return false;
    setQ('');
    return true;
  }, []);
  useKeyLayer(onKey);

  const shown = showAll || q ? channels : channels.slice(0, CHANNEL_CAP);

  const toggleIn = (set: ReadonlySet<string>, key: string) => {
    const next = new Set(set);
    if (next.has(key)) next.delete(key); else next.add(key);
    return next;
  };

  return (
    <nav class="sidebar" aria-label={t('openFilters')}>
      <div class="brand">
        <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true">
          <rect width="24" height="24" rx="6" fill="#FFC531" />
          <g fill="#1a1400"><rect x="5" y="6" width="4" height="12" rx="1" /><rect x="10" y="10" width="4" height="8" rx="1" /><rect x="15" y="14" width="4" height="4" rx="1" /></g>
        </svg>
        <span class="wordmark">LaterTidy</span>
        <button class="icon drawer-close" aria-label={t('close')} onClick={() => app.set({ drawer: false })}><IconClose /></button>
      </div>

      <section>
        <h2>{t('status')}</h2>
        {STATUSES.filter((s) => s !== 'live' || facets.status.live > 0).map((s) => (
          <Row key={s} label={t(`status.${s}` as Key)} count={facets.status[s]} active={filters.status === s}
            onClick={() => app.setFilters({ status: s })} />
        ))}
        <div class="rule" />
        <Row label={t('withNote')} count={facets.withNote} active={filters.hasNote} onClick={() => app.setFilters({ hasNote: !filters.hasNote })} />
      </section>

      <section>
        <div class="section-head">
          <h2>{t('categories')}</h2>
          <button class="mini" aria-label={t('newCategory')} title={t('newCategory')} onClick={() => setCreating(true)}><IconPlus /></button>
        </div>
        {creating && (
          <input class="field small" autoFocus placeholder={t('categoryName')} aria-label={t('categoryName')} maxLength={40} data-create-category
            onBlur={(e) => { const v = e.currentTarget.value; if (v.trim()) app.createCategory(v); setCreating(false); }} />
        )}
        {meta.categories.map((c) => (
          <div class="row-wrap" key={c.id}>
            <Row label={c.name} dot={c.color} count={facets.categories.get(c.id) ?? 0} active={filters.categories.has(c.id)}
              onClick={() => app.setFilters({ categories: toggleIn(filters.categories, c.id) })} />
            <button class="mini row-more" aria-label={t('editCategory', { name: c.name })} title={t('editCategory', { name: c.name })}
              onClick={(e) => app.set({ popover: { kind: 'categoryEdit', categoryId: c.id, anchor: anchorOf(e.currentTarget) } })}><IconMore /></button>
          </div>
        ))}
        {meta.categories.length > 0
          ? <Row label={t('uncategorized')} count={facets.categories.get(UNCATEGORIZED) ?? 0} active={filters.categories.has(UNCATEGORIZED)}
              onClick={() => app.setFilters({ categories: toggleIn(filters.categories, UNCATEGORIZED) })} />
          : !creating && <p class="hint">{t('noCategories')}</p>}
      </section>

      <section class="channels">
        <h2>{t('channels')}</h2>
        <input class="field small" type="search" placeholder={t('channelSearch')} aria-label={t('channelSearch')} value={q} data-channel-search
          onInput={(e) => setQ(e.currentTarget.value)} />
        <div class="channel-list">
          {shown.map((c) => (
            <Row key={c.key} label={c.name || t('unknownChannel')} title={c.name} count={c.count} active={filters.channels.has(c.key)}
              onClick={() => app.setFilters({ channels: toggleIn(filters.channels, c.key) })} />
          ))}
          {!shown.length && <p class="hint">{t('noChannels')}</p>}
          {!showAll && !q && channels.length > CHANNEL_CAP && (
            <button class="link" onClick={() => setShowAll(true)}>{t('showAllChannels', { n: channels.length })}</button>
          )}
        </div>
      </section>
    </nav>
  );
}
