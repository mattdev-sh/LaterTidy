import { BUCKETS, bucketOf } from './histogram';
import { remainingSec, statusOf } from './time';
import { fold, terms } from './search';
import type { Meta, SortKey, Status, Video } from './types';

export const UNCATEGORIZED = '__none';
export type StatusFilter = 'all' | Status;
export type Range = readonly [number, number];

export interface Filters {
  query: string;
  status: StatusFilter;
  channels: ReadonlySet<string>;
  /** Category ids and/or UNCATEGORIZED. A video passes when it matches any. */
  categories: ReadonlySet<string>;
  hasNote: boolean;
  /** Inclusive bucket indexes; null means the whole axis. */
  range: Range | null;
}

export const emptyFilters = (): Filters => ({
  query: '', status: 'all', channels: new Set(), categories: new Set(), hasNote: false, range: null,
});

export const filtersActive = (f: Filters) => !!(
  f.query.trim() || f.status !== 'all' || f.channels.size || f.categories.size || f.hasNote || f.range
);

export const channelKey = (v: Video) => v.channelId ?? `name:${v.channel}`;

export interface Facets {
  status: Record<StatusFilter, number>;
  channels: Map<string, { name: string; count: number }>;
  categories: Map<string, number>;
  withNote: number;
  histogram: number[];
}

export interface Derived { view: Video[]; facets: Facets }

/** Pre-folded title + channel per video; rebuilt only when the list changes. */
export type SearchIndex = Map<string, string>;
export function buildIndex(videos: readonly Video[]): SearchIndex {
  return new Map(videos.map((v) => [v.id, fold(`${v.title}\n${v.channel}`)]));
}

const DIMENSIONS = 6;
const [D_QUERY, D_STATUS, D_CHANNEL, D_CATEGORY, D_NOTE, D_RANGE] = [0, 1, 2, 3, 4, 5] as const;

/**
 * One pass over the list. A video failing no dimension joins the view and counts in every facet;
 * a video failing exactly one counts only in that dimension's facet, which is what makes each
 * facet reflect all the other active filters.
 */
export function derive(videos: readonly Video[], f: Filters, meta: Meta, index: SearchIndex, sort: SortKey): Derived {
  const queryTerms = terms(f.query);
  const known = new Set(meta.categories.map((c) => c.id));
  const facets: Facets = {
    status: { all: 0, notStarted: 0, inProgress: 0, finished: 0, unavailable: 0, live: 0 },
    channels: new Map(), categories: new Map(), withNote: 0, histogram: new Array(BUCKETS).fill(0),
  };
  const view: Video[] = [];
  const fails = new Uint8Array(DIMENSIONS);

  for (const v of videos) {
    const m = meta.videos[v.id];
    const note = m?.note ?? '';
    const cats = m ? m.categoryIds.filter((c) => known.has(c)) : [];
    const status = statusOf(v);
    const chan = channelKey(v);
    const bucket = v.lengthSec == null ? -1 : bucketOf(v.lengthSec);

    fails.fill(0);
    if (queryTerms.length) {
      const hay = (index.get(v.id) ?? '') + (note ? '\n' + fold(note) : '');
      if (!queryTerms.every((t) => hay.includes(t))) fails[D_QUERY] = 1;
    }
    if (f.status !== 'all' && status !== f.status) fails[D_STATUS] = 1;
    if (f.channels.size && !f.channels.has(chan)) fails[D_CHANNEL] = 1;
    if (f.categories.size) {
      const any = cats.length ? cats.some((c) => f.categories.has(c)) : f.categories.has(UNCATEGORIZED);
      if (!any) fails[D_CATEGORY] = 1;
    }
    if (f.hasNote && !note) fails[D_NOTE] = 1;
    if (f.range && (bucket < f.range[0] || bucket > f.range[1])) fails[D_RANGE] = 1;

    let failed = 0, which = -1;
    for (let d = 0; d < DIMENSIONS; d++) if (fails[d]) { failed++; which = d; }
    if (failed > 1) continue;
    const all = failed === 0;
    if (all) view.push(v);
    if (all || which === D_STATUS) { facets.status.all++; facets.status[status]++; }
    if (all || which === D_CHANNEL) {
      const c = facets.channels.get(chan);
      if (c) c.count++; else facets.channels.set(chan, { name: v.channel, count: 1 });
    }
    if (all || which === D_CATEGORY) {
      if (!cats.length) facets.categories.set(UNCATEGORIZED, (facets.categories.get(UNCATEGORIZED) ?? 0) + 1);
      for (const c of cats) facets.categories.set(c, (facets.categories.get(c) ?? 0) + 1);
    }
    if ((all || which === D_NOTE) && note) facets.withNote++;
    if ((all || which === D_RANGE) && bucket >= 0) facets.histogram[bucket]!++;
  }
  return { view: sorted(view, sort), facets };
}

const byNullableNumber = (get: (v: Video) => number | null, dir: 1 | -1) => (a: Video, b: Video) => {
  const x = get(a), y = get(b);
  if (x == null) return y == null ? 0 : 1; // unknown values always go last
  if (y == null) return -1;
  return (x - y) * dir;
};

/** View-only: never touches the order on YouTube. Sort is stable, so ties keep YouTube order. */
export function sorted(list: Video[], key: SortKey): Video[] {
  switch (key) {
    case 'youtube': return list;
    case 'reverse': return [...list].reverse();
    case 'shortest': return [...list].sort(byNullableNumber((v) => v.lengthSec, 1));
    case 'longest': return [...list].sort(byNullableNumber((v) => v.lengthSec, -1));
    case 'leastRemaining': return [...list].sort(byNullableNumber((v) => v.lengthSec == null ? null : remainingSec(v), 1));
    case 'channel': return [...list].sort((a, b) => a.channel.localeCompare(b.channel, undefined, { sensitivity: 'base' }));
    case 'newest': return [...list].sort(byNullableNumber((v) => v.publishedAt, -1));
    case 'oldest': return [...list].sort(byNullableNumber((v) => v.publishedAt, 1));
  }
}
