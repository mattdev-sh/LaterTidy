import { useCallback, useRef, useState } from 'preact/hooks';
import { axisPos, BUCKETS, bucketEdge, TICKS } from '../core/histogram';
import { fmtEdge, t } from '../i18n';
import { useKeyLayer, type KeyLayer } from '../app/keys';
import { useApp } from './shared';
import { IconClose } from './icons';

const rangeText = (lo: number, hi: number) => {
  const a = bucketEdge(lo), b = bucketEdge(hi + 1);
  if (lo === 0 && hi === BUCKETS - 1) return t('rangeAny');
  if (hi === BUCKETS - 1) return `${fmtEdge(a)}+`;
  return lo === 0 ? `<${fmtEdge(b)}` : t('rangeFrom', { a: fmtEdge(a), b: fmtEdge(b) });
};

const bucketText = (i: number) => rangeText(i, i);

export function Histogram({ bars }: { bars: number[] }) {
  const app = useApp();
  const range = app.state.filters.range;
  const [lo, hi] = range ?? [0, BUCKETS - 1];
  const track = useRef<HTMLDivElement>(null);
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(1, ...bars);

  const apply = (a: number, b: number) => {
    const next = a === 0 && b === BUCKETS - 1 ? null : ([a, b] as const);
    const cur = app.state.filters.range;
    if (cur?.[0] !== next?.[0] || cur?.[1] !== next?.[1]) app.setFilters({ range: next });
  };

  const bucketAt = (clientX: number) => {
    const r = track.current!.getBoundingClientRect();
    return Math.max(0, Math.min(BUCKETS - 1, Math.floor(((clientX - r.left) / r.width) * BUCKETS)));
  };

  const drag = (e: PointerEvent, mode: 'min' | 'max' | 'brush') => {
    e.preventDefault();
    e.stopPropagation();
    const el = track.current!;
    el.setPointerCapture(e.pointerId);
    const start = bucketAt(e.clientX);
    const [loNow, hiNow] = app.state.filters.range ?? [0, BUCKETS - 1];
    if (mode === 'brush') apply(start, start);
    const move = (ev: PointerEvent) => {
      const at = bucketAt(ev.clientX);
      if (mode === 'min') apply(Math.min(at, hiNow), hiNow);
      else if (mode === 'max') apply(loNow, Math.max(at, loNow));
      else apply(Math.min(start, at), Math.max(start, at));
    };
    const up = () => {
      el.removeEventListener('pointermove', move);
      el.removeEventListener('pointerup', up);
      el.removeEventListener('pointercancel', up);
    };
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
  };

  const onKey = useCallback<KeyLayer>((e, target) => {
    const which = target.dataset?.handle;
    if (!which) return false;
    const step = e.shiftKey ? 3 : 1;
    const [a, b] = app.state.filters.range ?? [0, BUCKETS - 1];
    const delta = { ArrowLeft: -step, ArrowDown: -step, ArrowRight: step, ArrowUp: step }[e.key];
    if (delta !== undefined) {
      if (which === 'min') apply(Math.max(0, Math.min(a + delta, b)), b);
      else apply(a, Math.min(BUCKETS - 1, Math.max(b + delta, a)));
      return true;
    }
    if (e.key === 'Home') { if (which === 'min') apply(0, b); else apply(a, a); return true; }
    if (e.key === 'End') { if (which === 'min') apply(b, b); else apply(a, BUCKETS - 1); return true; }
    return false;
  }, []);
  useKeyLayer(onKey);

  const pct = (i: number) => `${(i / BUCKETS) * 100}%`;

  return (
    <div class="hist" role="group" aria-label={t('histogramLabel')}>
      <div class="hist-track" ref={track} onPointerDown={(e) => drag(e as PointerEvent, 'brush')}
        onPointerMove={(e) => setHover(bucketAt((e as PointerEvent).clientX))} onPointerLeave={() => setHover(null)}>
        {bars.map((count, i) => {
          const on = i >= lo && i <= hi;
          const h = count ? Math.max(3, (count / max) * 72) : 0;
          return (
            <div key={i} class={`bar${on ? ' on' : ''}${hover === i ? ' hover' : ''}`}>
              <i style={{ height: `${h}px` }} />
            </div>
          );
        })}
        <div class="handle" role="slider" tabIndex={0} data-handle="min" aria-label={t('handleMin')}
          aria-valuemin={0} aria-valuemax={BUCKETS - 1} aria-valuenow={lo} aria-valuetext={rangeText(lo, hi)}
          style={{ left: pct(lo) }} onPointerDown={(e) => drag(e as PointerEvent, 'min')} />
        <div class="handle" role="slider" tabIndex={0} data-handle="max" aria-label={t('handleMax')}
          aria-valuemin={0} aria-valuemax={BUCKETS - 1} aria-valuenow={hi} aria-valuetext={rangeText(lo, hi)}
          style={{ left: pct(hi + 1) }} onPointerDown={(e) => drag(e as PointerEvent, 'max')} />
        {hover !== null && (
          <div class={`hist-tip${hover > BUCKETS * 0.7 ? ' flip' : ''}`} style={{ left: `calc(${pct(hover)} + ${50 / BUCKETS}%)` }}>
            {t('barTip', { n: bars[hover] ?? 0, range: bucketText(hover) })}
          </div>
        )}
      </div>
      <div class="hist-axis" aria-hidden="true">
        {TICKS.map((tk) => <span key={tk.label} style={{ left: `${axisPos(tk.sec) * 100}%` }}>{tk.label}</span>)}
      </div>
      <div class="hist-read">
        {range && <span class="range-text">{rangeText(lo, hi)}</span>}
        {range && <button class="mini" aria-label={t('clearRange')} title={t('clearRange')} onClick={() => app.setFilters({ range: null })}><IconClose /></button>}
      </div>
    </div>
  );
}
