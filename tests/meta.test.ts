import { describe, expect, it } from 'vitest';
import { parseBackup, toCsv, toJson } from '../src/core/backup';
import { sanitizeConfig } from '../src/core/config';
import {
  addCategory, deleteCategory, emptyMeta, findCategoryByName, mergeMeta, NOTE_MAX, PALETTE, restoreCategory, sanitizeMeta,
  setAssignment, setNote, updateCategory,
} from '../src/core/meta';
import type { Meta } from '../src/core/types';
import { video } from './fixtures';

const seeded = () => {
  const a = addCategory(emptyMeta(), 'Studio');
  const b = addCategory(a.meta, 'Svago');
  return { meta: b.meta, a: a.category, b: b.category };
};

describe('categories', () => {
  it('creates once per name, ignoring case and spacing', () => {
    const { meta, a } = seeded();
    const again = addCategory(meta, '  studio ');
    expect(again.category.id).toBe(a.id);
    expect(again.meta).toBe(meta);
  });
  it('assigns distinct colors from the palette, then wraps', () => {
    let meta = emptyMeta();
    for (let i = 0; i < PALETTE.length + 1; i++) meta = addCategory(meta, `c${i}`).meta;
    expect(new Set(meta.categories.slice(0, PALETTE.length).map((c) => c.color)).size).toBe(PALETTE.length);
    expect(PALETTE).toContain(meta.categories.at(-1)!.color);
  });
  it('renames and recolors, refusing blanks and duplicates', () => {
    const { meta, a } = seeded();
    expect(findCategoryByName(updateCategory(meta, a.id, { name: 'Lavoro' }), 'lavoro')?.id).toBe(a.id);
    expect(updateCategory(meta, a.id, { name: '  ' })).toBe(meta);
    expect(updateCategory(meta, a.id, { name: 'svago' })).toBe(meta);
    expect(updateCategory(meta, a.id, { color: PALETTE[3]! }).categories[0]!.color).toBe(PALETTE[3]);
  });
  it('assigns in bulk, multiple per video, and unassigns', () => {
    const { meta, a, b } = seeded();
    let m = setAssignment(meta, ['v1', 'v2'], a.id, true);
    m = setAssignment(m, ['v1'], b.id, true);
    expect(m.videos.v1!.categoryIds).toEqual([a.id, b.id]);
    m = setAssignment(m, ['v1', 'v2'], a.id, false);
    expect(m.videos.v1!.categoryIds).toEqual([b.id]);
    expect(m.videos.v2).toBeUndefined();
  });
  it('delete strips assignments and undo puts them back in place', () => {
    const { meta, a, b } = seeded();
    const m = setNote(setAssignment(meta, ['v1'], a.id, true), 'v2', 'x');
    const { meta: after, removed } = deleteCategory(setAssignment(m, ['v2'], a.id, true), a.id);
    expect(after.categories.map((c) => c.id)).toEqual([b.id]);
    expect(after.videos.v1).toBeUndefined();
    expect(after.videos.v2!.note).toBe('x');
    const back = restoreCategory(after, removed!);
    expect(back.categories.map((c) => c.id)).toEqual([a.id, b.id]);
    expect(back.videos.v1!.categoryIds).toEqual([a.id]);
    expect(back.videos.v2!.categoryIds).toEqual([a.id]);
  });
  it('delete of an unknown id is a no-op', () => {
    const { meta } = seeded();
    expect(deleteCategory(meta, 'nope').meta).toBe(meta);
  });
});

describe('notes', () => {
  it('stores, trims to the limit, and deletes when empty', () => {
    let m = setNote(emptyMeta(), 'v1', 'ciao', 5);
    expect(m.videos.v1).toEqual({ categoryIds: [], note: 'ciao', updatedAt: 5 });
    expect(setNote(m, 'v1', 'x'.repeat(NOTE_MAX + 50)).videos.v1!.note).toHaveLength(NOTE_MAX);
    m = setNote(m, 'v1', '   ');
    expect(m.videos.v1).toBeUndefined();
  });
  it('keeps categories when the note goes', () => {
    const { meta, a } = seeded();
    const m = setNote(setNote(setAssignment(meta, ['v1'], a.id, true), 'v1', 'x'), 'v1', '');
    expect(m.videos.v1!.categoryIds).toEqual([a.id]);
  });
  it('is unchanged by an identical save', () => {
    const m = setNote(emptyMeta(), 'v1', 'x');
    expect(setNote(m, 'v1', 'x')).toBe(m);
  });
});

describe('sanitizeMeta', () => {
  it('rejects non-objects', () => {
    expect(sanitizeMeta(null)).toBeNull();
    expect(sanitizeMeta({ categories: 'x', videos: {} })).toBeNull();
    expect(sanitizeMeta([])).toBeNull();
  });
  it('drops bad entries and repairs the rest', () => {
    const m = sanitizeMeta({
      categories: [{ id: 'c1', name: ' Ok ', color: 'javascript:alert(1)' }, { id: 'c1', name: 'dup' }, { id: 5, name: 'bad' }, { id: 'c2', name: '' }],
      videos: {
        goodvideo01: { categoryIds: ['c1', 'c1', 'ghost', 3], note: 42, updatedAt: 'x' },
        '<img src=x>': { categoryIds: ['c1'], note: 'x' },
        emptyvideo1: { categoryIds: [], note: '  ' },
        longnotevid: { categoryIds: [], note: 'y'.repeat(NOTE_MAX + 1), updatedAt: 3 },
      },
    })!;
    expect(m.categories).toEqual([{ id: 'c1', name: 'Ok', color: PALETTE[0] }]);
    expect(Object.keys(m.videos).sort()).toEqual(['goodvideo01', 'longnotevid']);
    expect(m.videos.goodvideo01).toEqual({ categoryIds: ['c1'], note: '', updatedAt: 0 });
    expect(m.videos.longnotevid!.note).toHaveLength(NOTE_MAX);
  });
  it('does not pollute prototypes', () => {
    const m = sanitizeMeta(JSON.parse('{"categories":[],"videos":{"__proto__":{"note":"x","categoryIds":[]},"constructor":{"note":"y","categoryIds":[]}}}'))!;
    expect(({} as any).note).toBeUndefined();
    expect(Object.getPrototypeOf(m.videos)).toBeNull();
    expect(Object.keys(m.videos)).toEqual(['__proto__', 'constructor']);
    const merged = mergeMeta(emptyMeta(), m).meta;
    expect(Object.getPrototypeOf(merged.videos)).toBeNull();
    expect(merged.videos['__proto__']?.note).toBe('x');
    expect(setNote(merged, 'constructor', 'safe').videos['constructor']?.note).toBe('safe');
  });
});

describe('mergeMeta', () => {
  it('merges by name without duplicates and remaps ids', () => {
    const { meta, a } = seeded();
    const base = setAssignment(meta, ['v1'], a.id, true);
    const incoming: Meta = {
      categories: [{ id: 'other', name: 'STUDIO', color: PALETTE[2]! }, { id: 'nuova', name: 'Nuova', color: PALETTE[3]! }],
      videos: { v1: { categoryIds: ['other', 'nuova'], note: '', updatedAt: 1 }, v2: { categoryIds: ['other'], note: 'n', updatedAt: 1 } },
    };
    const { meta: m, report } = mergeMeta(base, incoming);
    expect(m.categories).toHaveLength(3);
    expect(m.videos.v1!.categoryIds).toEqual([a.id, 'nuova']);
    expect(m.videos.v2).toEqual({ categoryIds: [a.id], note: 'n', updatedAt: 1 });
    expect(report).toEqual({ categoriesAdded: 1, assignmentsAdded: 2, notesAdded: 1, notesSkipped: 0 });
    expect(mergeMeta(m, incoming).report).toMatchObject({ categoriesAdded: 0, assignmentsAdded: 0, notesAdded: 0 });
  });
  it('resolves note conflicts by updatedAt', () => {
    const base = setNote(emptyMeta(), 'v1', 'mia', 10);
    const older: Meta = { categories: [], videos: { v1: { categoryIds: [], note: 'vecchia', updatedAt: 5 } } };
    const newer: Meta = { categories: [], videos: { v1: { categoryIds: [], note: 'nuova', updatedAt: 20 } } };
    expect(mergeMeta(base, older).meta.videos.v1!.note).toBe('mia');
    expect(mergeMeta(base, older).report.notesSkipped).toBe(1);
    expect(mergeMeta(base, newer).meta.videos.v1!.note).toBe('nuova');
  });
  it('renames an id clash', () => {
    const base: Meta = { categories: [{ id: 'x', name: 'A', color: PALETTE[0]! }], videos: {} };
    const { meta } = mergeMeta(base, { categories: [{ id: 'x', name: 'B', color: PALETTE[1]! }], videos: {} });
    expect(new Set(meta.categories.map((c) => c.id)).size).toBe(2);
  });
});

describe('backup', () => {
  const { meta, a } = seeded();
  const full = setNote(setAssignment(meta, ['vid00000001'], a.id, true), 'vid00000001', 'nota, con "virgole"\nriga due', 9);
  const list = [video('vid00000001', { title: '=HYPERLINK("x")' }), video('vid00000002')];

  it('round trips categories and notes through JSON', () => {
    expect(parseBackup(toJson(list, full))).toEqual(full);
  });
  it('rejects other files', () => {
    expect(parseBackup('not json')).toBeNull();
    expect(parseBackup('{"schema":"other","version":1}')).toBeNull();
    expect(parseBackup('{"schema":"latertidy-backup","version":2,"meta":{"categories":[],"videos":{}}}')).toBeNull();
    expect(parseBackup('{"schema":"latertidy-backup","version":1,"meta":{"categories":3}}')).toBeNull();
  });
  it('writes CSV with categories, notes, quoting and formula defusing', () => {
    const csv = toCsv(list, full);
    const [head, ...rest] = csv.trim().split('\r\n');
    expect(head!.endsWith('categories,note')).toBe(true);
    expect(rest[0]).toContain(`"'=HYPERLINK(""x"")"`);
    expect(rest[0]).toContain('Studio');
    expect(rest[0]).toContain('"nota, con ""virgole""\nriga due"');
  });
});

describe('sanitizeConfig', () => {
  const good = { clientVersion: '2.1', context: { client: {} }, loggedIn: true, hl: 'it' };
  it('accepts a logged-in config and a logged-out one', () => {
    expect(sanitizeConfig(good)?.hl).toBe('it');
    expect(sanitizeConfig({ loggedIn: false })?.loggedIn).toBe(false);
  });
  it('refuses a logged-in config with no context', () => {
    expect(sanitizeConfig({ ...good, context: null })).toBeNull();
    expect(sanitizeConfig('x')).toBeNull();
  });
});
