import { useMemo } from 'preact/hooks';
import { queueUrl, QUEUE_CAP } from '../core/budget';
import { totalRemaining } from '../core/time';
import { fmtDur, t } from '../i18n';
import { anchorOf, useApp } from './shared';
import { IconAdd, IconBottom, IconClose, IconPlay, IconTag, IconTop, IconTrash } from './icons';

export function Dock() {
  const app = useApp();
  const { selection, canReorder, confirmRemove, videos } = app.state;
  const ids = useMemo(() => [...selection], [selection]);
  const chosen = useMemo(() => videos.filter((v) => selection.has(v.id)), [selection, videos]);
  const time = useMemo(() => totalRemaining(chosen), [chosen]);
  const view = app.derived().view;
  const outside = useMemo(() => {
    const inView = new Set(view.map((v) => v.id));
    return ids.filter((id) => !inView.has(id)).length;
  }, [view, ids]);
  if (!ids.length) return null;
  const playable = chosen.filter((v) => v.playable);
  const capped = playable.length > QUEUE_CAP;

  return (
    <div class="dock" role="toolbar" aria-label={t('selectionCount', { n: ids.length })}>
      <div class="dock-count">
        <strong>{t('selectionCount', { n: ids.length })}</strong>
        <span class="dock-time">{fmtDur(time)}</span>
        {outside > 0 && <span class="dock-out">{t('outsideFilters', { n: outside })}</span>}
      </div>
      <div class="dock-actions">
        {playable.length > 0 && (
          <a class="btn primary" href={queueUrl(playable.map((v) => v.id))} title={capped ? t('cappedNote') : undefined} data-action="play">
            <IconPlay />{t('play')}{capped && <span class="cap">50</span>}
          </a>
        )}
        <button class="btn" onClick={(e) => app.set({ popover: { kind: 'categories', ids, anchor: anchorOf(e.currentTarget) } })}><IconTag />{t('pickCategories')}</button>
        <button class="btn" onClick={(e) => void app.openPlaylists(ids, anchorOf(e.currentTarget))}><IconAdd />{t('addToPlaylist')}</button>
        {canReorder && <button class="btn icon-only" aria-label={t('moveTop')} title={t('moveTop')} onClick={() => void app.move(ids, 'top')}><IconTop /></button>}
        {canReorder && <button class="btn icon-only" aria-label={t('moveBottom')} title={t('moveBottom')} onClick={() => void app.move(ids, 'bottom')}><IconBottom /></button>}
        <button class={`btn danger${confirmRemove === 'dock' ? ' armed' : ''}`} data-action="remove" onClick={() => app.requestRemove(ids, 'dock')}>
          <IconTrash />{confirmRemove === 'dock' ? t('confirmRemove', { n: ids.length }) : t('remove')}
        </button>
        <button class="icon" aria-label={t('clearSelection')} title={t('clearSelection')} onClick={() => app.clearSelection()}><IconClose /></button>
      </div>
    </div>
  );
}
