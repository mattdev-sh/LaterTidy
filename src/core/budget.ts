import { remainingSec, statusOf } from './time';
import type { Video } from './types';

export const QUEUE_CAP = 50;

export interface BudgetPick { videos: Video[]; total: number }

const ATTEMPTS = 24;

/**
 * Randomized greedy fill: larger items go first, with noise on the order, and the first attempt
 * that fills the budget well and differs from `previous` wins. Otherwise the fullest attempt.
 */
export function pickBudget(
  items: readonly Video[], budgetSec: number,
  opts: { rng?: () => number; previous?: ReadonlySet<string> } = {},
): BudgetPick {
  const rng = opts.rng ?? Math.random;
  const pool = items.filter((v) => {
    const s = statusOf(v);
    return s !== 'finished' && s !== 'unavailable' && s !== 'live' && remainingSec(v) > 0;
  });
  const prev = opts.previous;
  let best: BudgetPick & { differs: boolean } = { videos: [], total: 0, differs: false };
  for (let attempt = 0; attempt < ATTEMPTS; attempt++) {
    const order = pool
      .map((v) => ({ v, rem: remainingSec(v), key: remainingSec(v) * (0.35 + rng() * 1.3) }))
      .sort((a, b) => b.key - a.key);
    const videos: Video[] = [];
    let total = 0;
    for (const { v, rem } of order) {
      if (videos.length >= QUEUE_CAP) break;
      if (total + rem <= budgetSec) { videos.push(v); total += rem; }
      if (budgetSec - total < 30) break;
    }
    const differs = !prev || videos.length !== prev.size || videos.some((v) => !prev.has(v.id));
    const better = differs !== best.differs ? differs : total > best.total;
    if (better) best = { videos, total, differs };
    if (differs && total >= budgetSec * 0.9) break;
  }
  return { videos: best.videos, total: best.total };
}

export const queueUrl = (ids: readonly string[]) =>
  `https://www.youtube.com/watch_videos?video_ids=${ids.slice(0, QUEUE_CAP).join(',')}`;
