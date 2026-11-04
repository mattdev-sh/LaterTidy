import { describe, expect, it } from 'vitest';
import { parseAge } from '../src/core/age';
import { pickBudget, queueUrl } from '../src/core/budget';
import { buildIndex, derive, emptyFilters, sorted, UNCATEGORIZED, type Filters } from '../src/core/filter';
import { axisPos, BUCKETS, bucketEdge, bucketOf } from '../src/core/histogram';
import { emptyMeta, setAssignment, setNote, addCategory } from '../src/core/meta';
import { firstHitIndex, fold, highlight, terms } from '../src/core/search';
import { sha1Hex } from '../src/core/sha1';
import { FINISHED_PCT, remainingSec, statusOf, totalRemaining } from '../src/core/time';
import { video } from './fixtures';

const NOW = 1_800_000_000_000;
const DAY = 86_400_000;

describe('age parsing', () => {
  it.each([
    ['3 gg fa', 3], ['2 settimane fa', 14], ['1 mese fa', 30.44], ['2 anni fa', 730.5],
    ['3 days ago', 3], ['2 weeks ago', 14], ['5 years ago', 1826.25], ['Streamed 4 hours ago', 4 / 24],
    ['Trasmesso in streaming 2 giorni fa', 2], ['un anno fa', 365.25], ['a month ago', 30.44],
  ])('%s', (text, days) => {
    expect(parseAge(text, NOW)).toBeCloseTo(NOW - days * DAY, -3);
  });
  it('returns null when unreadable', () => {
    expect(parseAge('poco fa', NOW)).toBeNull();
    expect(parseAge('', NOW)).toBeNull();
    expect(parseAge(null, NOW)).toBeNull();
  });
});

describe('remaining time and status', () => {
  it('subtracts progress', () => {
    expect(remainingSec(video('a', { lengthSec: 1000, pct: 25 }))).toBe(750);
    expect(remainingSec(video('a', { lengthSec: 1000 }))).toBe(1000);
  });
  it('is zero when watched, unknown or unavailable', () => {
    expect(remainingSec(video('a', { watched: true, pct: 30 }))).toBe(0);
    expect(remainingSec(video('a', { lengthSec: null }))).toBe(0);
    expect(remainingSec(video('a', { playable: false }))).toBe(0);
  });
  it('sums', () => {
    expect(totalRemaining([video('a', { lengthSec: 100 }), video('b', { lengthSec: 300, pct: 50 })])).toBe(250);
  });
  it('classifies', () => {
    expect(statusOf(video('a'))).toBe('notStarted');
    expect(statusOf(video('a', { pct: 1 }))).toBe('inProgress');
    expect(statusOf(video('a', { pct: FINISHED_PCT - 1 }))).toBe('inProgress');
    expect(statusOf(video('a', { pct: FINISHED_PCT }))).toBe('finished');
    expect(statusOf(video('a', { watched: true }))).toBe('finished');
    expect(statusOf(video('a', { playable: false, watched: true }))).toBe('unavailable');
    expect(statusOf(video('a', { live: 'upcoming' }))).toBe('live');
  });
});

describe('search', () => {
  it('folds diacritics and case', () => {
    expect(fold('Perché CAFFÈ Ñandú')).toBe('perche caffe nandu');
    expect(terms('  Più   tardi ')).toEqual(['piu', 'tardi']);
  });
  it('highlights original text across diacritics', () => {
    expect(highlight('Il caffè è pronto', ['caffe']).filter((p) => p.hit).map((p) => p.text)).toEqual(['caffè']);
    expect(highlight('nothing', ['zz'])).toEqual([{ text: 'nothing', hit: false }]);
    expect(highlight('abc', [])).toEqual([{ text: 'abc', hit: false }]);
    expect(highlight('a b a', ['a']).map((p) => p.hit)).toEqual([true, false, true]);
  });
  it('locates the first hit', () => {
    expect(firstHitIndex('un perché lungo', ['perche'])).toBe(3);
    expect(firstHitIndex('x', ['y'])).toBe(-1);
  });
});

describe('derive', () => {
  const list = [
    video('v1', { title: 'Caffè espresso', channel: 'Bar', channelId: 'UC1', lengthSec: 300 }),
    video('v2', { title: 'Pasta fresca', channel: 'Cucina', channelId: 'UC2', lengthSec: 3600, pct: 50 }),
    video('v3', { title: 'Caffè lungo', channel: 'Cucina', channelId: 'UC2', lengthSec: 30, watched: true }),
    video('v4', { title: 'Sparito', channel: 'Bar', channelId: 'UC1', playable: false, lengthSec: null }),
    video('v5', { title: 'Insieme', channel: 'Due Canali', channelId: null, lengthSec: 7200 }),
  ];
  const index = buildIndex(list);
  let meta = emptyMeta();
  const a = addCategory(meta, 'Studio'); meta = a.meta;
  const b = addCategory(meta, 'Svago'); meta = b.meta;
  meta = setAssignment(meta, ['v1', 'v2'], a.category.id, true);
  meta = setAssignment(meta, ['v2'], b.category.id, true);
  meta = setNote(meta, 'v5', 'Rivedere il perché del finale');
  const run = (f: Partial<Filters>, m = meta) => derive(list, { ...emptyFilters(), ...f }, m, index, 'youtube');
  const ids = (f: Partial<Filters>) => run(f).view.map((v) => v.id);

  it('search is AND over title and channel, diacritic-insensitive', () => {
    expect(ids({ query: 'caffe' })).toEqual(['v1', 'v3']);
    expect(ids({ query: 'CAFFÈ cucina' })).toEqual(['v3']);
    expect(ids({ query: 'caffe nessuno' })).toEqual([]);
  });
  it('search matches note text', () => {
    expect(ids({ query: 'perche finale' })).toEqual(['v5']);
  });
  it('filters by status, channel and duration range together', () => {
    expect(ids({ status: 'finished' })).toEqual(['v3']);
    expect(ids({ channels: new Set(['UC2']), status: 'inProgress' })).toEqual(['v2']);
    expect(ids({ channels: new Set(['name:Due Canali']) })).toEqual(['v5']);
    const b5m = bucketOf(300);
    expect(ids({ range: [b5m, b5m] })).toEqual(['v1']);
  });
  it('filters by category (OR within), and uncategorized', () => {
    expect(ids({ categories: new Set([b.category.id]) })).toEqual(['v2']);
    expect(ids({ categories: new Set([a.category.id, b.category.id]) })).toEqual(['v1', 'v2']);
    expect(ids({ categories: new Set([UNCATEGORIZED]) })).toEqual(['v3', 'v4', 'v5']);
    expect(ids({ categories: new Set([UNCATEGORIZED, b.category.id]) })).toEqual(['v2', 'v3', 'v4', 'v5']);
  });
  it('filters with-note independently of status', () => {
    expect(ids({ hasNote: true })).toEqual(['v5']);
    expect(ids({ hasNote: true, status: 'finished' })).toEqual([]);
  });
  it('ignores assignments to a category that no longer exists', () => {
    const orphan = { ...meta, categories: [] };
    expect(run({}, orphan).facets.categories.get(UNCATEGORIZED)).toBe(5);
  });
  it('facet counts reflect the other filters but not their own', () => {
    const { facets } = run({ status: 'finished', query: 'caffe' });
    expect(facets.status.all).toBe(2);
    expect(facets.status.finished).toBe(1);
    expect(facets.status.notStarted).toBe(1);
    expect([...facets.channels.values()].map((c) => c.count)).toEqual([1]);
    expect(facets.histogram.reduce((x, y) => x + y)).toBe(1);
  });
  it('category and note facets follow the same rule', () => {
    const { facets } = run({ categories: new Set([a.category.id]), hasNote: false, status: 'inProgress' });
    expect(facets.categories.get(a.category.id)).toBe(1);
    expect(facets.categories.get(b.category.id)).toBe(1);
    expect(facets.categories.get(UNCATEGORIZED) ?? 0).toBe(0);
    expect(run({ categories: new Set([UNCATEGORIZED]) }).facets.withNote).toBe(1);
  });
  it('histogram ignores unknown lengths', () => {
    expect(run({}).facets.histogram.reduce((x, y) => x + y)).toBe(4);
  });
});

describe('sort', () => {
  const list = [
    video('a', { lengthSec: 100, publishedAt: 5, channel: 'zeta' }),
    video('b', { lengthSec: 300, pct: 90, publishedAt: 9, channel: 'Àlfa' }),
    video('c', { lengthSec: null, publishedAt: null, channel: 'beta' }),
    video('d', { lengthSec: 200, publishedAt: 1, channel: 'gamma' }),
  ];
  const order = (k: Parameters<typeof sorted>[1]) => sorted([...list], k).map((v) => v.id).join('');
  it('keeps YouTube order by default and reverses', () => {
    expect(order('youtube')).toBe('abcd');
    expect(order('reverse')).toBe('dcba');
  });
  it('sorts by length and remaining, unknown last', () => {
    expect(order('shortest')).toBe('adbc');
    expect(order('longest')).toBe('bdac');
    expect(order('leastRemaining')).toBe('badc');
  });
  it('sorts channels and dates', () => {
    expect(order('channel')).toBe('bcda');
    expect(order('newest')).toBe('badc');
    expect(order('oldest')).toBe('dabc');
  });
  it('does not mutate the input for reverse', () => {
    const input = [...list];
    sorted(input, 'reverse');
    expect(input.map((v) => v.id).join('')).toBe('abcd');
  });
});

describe('histogram axis', () => {
  it('buckets the ends and the middle', () => {
    expect(bucketOf(30)).toBe(0);
    expect(bucketOf(60)).toBe(1);
    expect(bucketOf(10799)).toBe(BUCKETS - 2);
    expect(bucketOf(10800)).toBe(BUCKETS - 1);
  });
  it('edges bound their bucket', () => {
    for (let i = 1; i < BUCKETS - 1; i++) expect(bucketOf(bucketEdge(i) * 1.001)).toBe(i);
    expect(bucketEdge(BUCKETS)).toBe(Infinity);
  });
  it('axis positions are ordered inside the track', () => {
    expect(axisPos(60)).toBeGreaterThan(0);
    expect(axisPos(10800)).toBeLessThan(1);
    expect(axisPos(300)).toBeLessThan(axisPos(3600));
  });
});

describe('budget picker', () => {
  const pool = Array.from({ length: 60 }, (_, i) => video(`v${i}`, { lengthSec: 120 + i * 37 }));
  it('never exceeds the budget and uses most of it', () => {
    const { videos, total } = pickBudget(pool, 3600);
    expect(total).toBeLessThanOrEqual(3600);
    expect(total).toBeGreaterThan(3600 * 0.9);
    expect(videos.reduce((s, v) => s + remainingSec(v), 0)).toBe(total);
  });
  it('excludes finished, unavailable and live, and uses remaining time', () => {
    const { videos, total } = pickBudget([
      video('done', { watched: true, lengthSec: 100 }), video('gone', { playable: false }),
      video('live', { live: 'live' }), video('half', { lengthSec: 1000, pct: 50 }),
    ], 600);
    expect(videos.map((v) => v.id)).toEqual(['half']);
    expect(total).toBe(500);
  });
  it('gives a different set on the next roll', () => {
    const first = pickBudget(pool, 1800);
    const next = pickBudget(pool, 1800, { previous: new Set(first.videos.map((v) => v.id)) });
    expect(next.videos.map((v) => v.id).sort()).not.toEqual(first.videos.map((v) => v.id).sort());
  });
  it('returns nothing when nothing fits', () => {
    expect(pickBudget([video('a', { lengthSec: 9000 })], 900).videos).toEqual([]);
  });
  it('caps the queue URL at 50 ids', () => {
    const url = queueUrl(Array.from({ length: 80 }, (_, i) => `id${i}`));
    expect(url.split('=')[1]!.split(',')).toHaveLength(50);
    expect(url.startsWith('https://www.youtube.com/watch_videos?video_ids=id0,')).toBe(true);
  });
});

describe('sha1', () => {
  it('matches known vectors', () => {
    expect(sha1Hex('')).toBe('da39a3ee5e6b4b0d3255bfef95601890afd80709');
    expect(sha1Hex('abc')).toBe('a9993e364706816aba3e25717850c26c9cd0d89d');
    expect(sha1Hex('a'.repeat(1000))).toBe('291e9a6c66994949b57ba5e650361e98fc36b1ba');
    expect(sha1Hex('caffè')).toMatch(/^[0-9a-f]{40}$/);
  });
});
