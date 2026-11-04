/** Log-uniform length axis: one "<1m" bucket, 24 between 1m and 3h, one "3h+". */
export const LOG_BINS = 24;
export const BUCKETS = LOG_BINS + 2;
const MIN = 60;
const MAX = 10800;
const SPAN = Math.log(MAX / MIN);

export function bucketOf(lengthSec: number): number {
  if (lengthSec < MIN) return 0;
  if (lengthSec >= MAX) return BUCKETS - 1;
  return 1 + Math.min(LOG_BINS - 1, Math.floor((Math.log(lengthSec / MIN) / SPAN) * LOG_BINS));
}

/** Lower edge of a bucket in seconds. */
export function bucketEdge(i: number): number {
  if (i <= 0) return 0;
  if (i >= BUCKETS) return Infinity;
  return MIN * Math.exp(((i - 1) / LOG_BINS) * SPAN);
}

/** Position 0..1 of a length on the axis. */
export function axisPos(sec: number): number {
  const barW = 1 / BUCKETS;
  return barW + (Math.log(sec / MIN) / SPAN) * (LOG_BINS * barW);
}

export const TICKS: ReadonlyArray<{ sec: number; label: string }> = [
  { sec: 60, label: '1m' }, { sec: 300, label: '5m' }, { sec: 900, label: '15m' },
  { sec: 1800, label: '30m' }, { sec: 3600, label: '1h' }, { sec: 10800, label: '3h' },
];
