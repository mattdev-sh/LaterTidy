import type { Status, Video } from './types';

/** Percent at or above which a video counts as finished. */
export const FINISHED_PCT = 90;

export function statusOf(v: Video): Status {
  if (!v.playable) return 'unavailable';
  if (v.live) return 'live';
  if (v.watched || v.pct >= FINISHED_PCT) return 'finished';
  if (v.pct > 0) return 'inProgress';
  return 'notStarted';
}

/** Seconds left to watch; 0 when watched or length unknown. */
export function remainingSec(v: Video): number {
  if (v.lengthSec == null || !v.playable) return 0;
  if (v.watched) return 0;
  const pct = Math.min(100, Math.max(0, v.pct));
  return Math.round(v.lengthSec * (1 - pct / 100));
}

export const totalRemaining = (vs: readonly Video[]) =>
  vs.reduce((sum, v) => sum + remainingSec(v), 0);
