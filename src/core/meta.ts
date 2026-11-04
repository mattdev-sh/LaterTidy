import type { Category, Meta, VideoMeta } from './types';

export const NOTE_MAX = 2000;
export const NAME_MAX = 40;

/**
 * Fixed palette: mid-tone hues at 3:1 or better on every surface of both themes, ordered to keep
 * adjacent picks apart. Eight hues in this band can't all reach the color-blind separation target
 * (worst adjacent pair is about 5 delta E), so color is never the only cue: names sit beside the
 * dots in the sidebar and picker, and card dots carry a tooltip and an accessible name.
 */
export const PALETTE: readonly string[] = [
  '#0E8F80', '#8B5CF6', '#C2570C', '#2F7FE8', '#A9700A', '#B04FC4', '#3A9A3E', '#D6336C',
];

export const emptyMeta = (): Meta => ({ categories: [], videos: Object.create(null) });

const newId = () => 'c' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

export const cleanName = (name: string) => name.trim().replace(/\s+/g, ' ').slice(0, NAME_MAX);

export function findCategoryByName(meta: Meta, name: string): Category | undefined {
  const key = cleanName(name).toLocaleLowerCase();
  return meta.categories.find((c) => c.name.toLocaleLowerCase() === key);
}

function nextColor(meta: Meta): string {
  const used = meta.categories.map((c) => c.color);
  return PALETTE.find((c) => !used.includes(c)) ?? PALETTE[meta.categories.length % PALETTE.length]!;
}

/** All updates return new objects: state changes are detected by identity. */
export function addCategory(meta: Meta, name: string): { meta: Meta; category: Category } {
  const existing = findCategoryByName(meta, name);
  if (existing) return { meta, category: existing };
  const category = { id: newId(), name: cleanName(name), color: nextColor(meta) };
  return { meta: { ...meta, categories: [...meta.categories, category] }, category };
}

export function updateCategory(meta: Meta, id: string, patch: Partial<Omit<Category, 'id'>>): Meta {
  const name = patch.name === undefined ? undefined : cleanName(patch.name);
  if (name === '') return meta;
  if (name && meta.categories.some((c) => c.id !== id && c.name.toLocaleLowerCase() === name.toLocaleLowerCase())) {
    return meta;
  }
  return {
    ...meta,
    categories: meta.categories.map((c) => c.id === id ? { ...c, ...patch, ...(name ? { name } : {}) } : c),
  };
}

export interface DeletedCategory { category: Category; index: number; videoIds: string[] }

export function deleteCategory(meta: Meta, id: string): { meta: Meta; removed: DeletedCategory | null } {
  const index = meta.categories.findIndex((c) => c.id === id);
  if (index < 0) return { meta, removed: null };
  const videoIds: string[] = [];
  const videos = Object.assign(Object.create(null), meta.videos) as Meta['videos'];
  for (const [vid, m] of Object.entries(meta.videos)) {
    if (m.categoryIds.includes(id)) {
      videoIds.push(vid);
      setEntry(videos, vid, { ...m, categoryIds: m.categoryIds.filter((c) => c !== id) });
    }
  }
  return {
    meta: { categories: meta.categories.filter((c) => c.id !== id), videos },
    removed: { category: meta.categories[index]!, index, videoIds },
  };
}

export function restoreCategory(meta: Meta, removed: DeletedCategory): Meta {
  const categories = [...meta.categories];
  categories.splice(Math.min(removed.index, categories.length), 0, removed.category);
  const videos = Object.assign(Object.create(null), meta.videos) as Meta['videos'];
  for (const vid of removed.videoIds) {
    const m = videos[vid] ?? { categoryIds: [], note: '', updatedAt: 0 };
    if (!m.categoryIds.includes(removed.category.id)) {
      videos[vid] = { ...m, categoryIds: [...m.categoryIds, removed.category.id] };
    }
  }
  return { categories, videos };
}

/** Writes an entry, dropping it when it no longer carries anything. */
function setEntry(videos: Record<string, VideoMeta>, id: string, entry: VideoMeta) {
  if (!entry.categoryIds.length && !entry.note) delete videos[id];
  else videos[id] = entry;
}

export function setAssignment(meta: Meta, ids: readonly string[], categoryId: string, on: boolean, now = Date.now()): Meta {
  const videos = Object.assign(Object.create(null), meta.videos) as Meta['videos'];
  for (const id of ids) {
    const m = videos[id] ?? { categoryIds: [], note: '', updatedAt: now };
    const has = m.categoryIds.includes(categoryId);
    if (has === on) continue;
    setEntry(videos, id, {
      ...m,
      categoryIds: on ? [...m.categoryIds, categoryId] : m.categoryIds.filter((c) => c !== categoryId),
      updatedAt: now,
    });
  }
  return { ...meta, videos };
}

export function setNote(meta: Meta, id: string, note: string, now = Date.now()): Meta {
  const text = note.slice(0, NOTE_MAX);
  const clean = text.trim() ? text : '';
  const m = meta.videos[id] ?? { categoryIds: [], note: '', updatedAt: now };
  if (m.note === clean) return meta;
  const videos = Object.assign(Object.create(null), meta.videos) as Meta['videos'];
  setEntry(videos, id, { ...m, note: clean, updatedAt: now });
  return { ...meta, videos };
}

const VIDEO_ID = /^[\w-]{6,32}$/;
const isRecord = (x: unknown): x is Record<string, unknown> =>
  !!x && typeof x === 'object' && !Array.isArray(x);

/** Strict schema check for anything that came from a file or from storage. */
export function sanitizeMeta(input: unknown): Meta | null {
  if (!isRecord(input) || !Array.isArray(input.categories) || !isRecord(input.videos)) return null;
  const meta = emptyMeta();
  const ids = new Set<string>();
  for (const c of input.categories) {
    if (!isRecord(c) || typeof c.id !== 'string' || !c.id || c.id.length > 64 || typeof c.name !== 'string') continue;
    const name = cleanName(c.name);
    if (!name || ids.has(c.id)) continue;
    ids.add(c.id);
    const color = typeof c.color === 'string' && PALETTE.includes(c.color) ? c.color : PALETTE[meta.categories.length % PALETTE.length]!;
    meta.categories.push({ id: c.id, name, color });
  }
  for (const [vid, raw] of Object.entries(input.videos)) {
    if (!VIDEO_ID.test(vid) || !isRecord(raw)) continue;
    const categoryIds = Array.isArray(raw.categoryIds)
      ? [...new Set(raw.categoryIds.filter((c): c is string => typeof c === 'string' && ids.has(c)))] : [];
    const note = typeof raw.note === 'string' ? raw.note.slice(0, NOTE_MAX) : '';
    const updatedAt = typeof raw.updatedAt === 'number' && Number.isFinite(raw.updatedAt) ? raw.updatedAt : 0;
    if (categoryIds.length || note.trim()) meta.videos[vid] = { categoryIds, note, updatedAt };
  }
  return meta;
}

export interface MergeReport {
  categoriesAdded: number; assignmentsAdded: number; notesAdded: number; notesSkipped: number;
}

/** Merges without duplicates: categories match by name; a conflicting note keeps the newer one. */
export function mergeMeta(base: Meta, incoming: Meta): { meta: Meta; report: MergeReport } {
  const report: MergeReport = { categoriesAdded: 0, assignmentsAdded: 0, notesAdded: 0, notesSkipped: 0 };
  const categories = [...base.categories];
  const remap = new Map<string, string>();
  for (const c of incoming.categories) {
    const key = c.name.toLocaleLowerCase();
    const match = categories.find((x) => x.name.toLocaleLowerCase() === key);
    if (match) { remap.set(c.id, match.id); continue; }
    const id = categories.some((x) => x.id === c.id) ? newId() : c.id;
    categories.push({ ...c, id });
    remap.set(c.id, id);
    report.categoriesAdded++;
  }
  const videos = Object.assign(Object.create(null), base.videos) as Meta['videos'];
  for (const [vid, m] of Object.entries(incoming.videos)) {
    const cur = videos[vid] ?? { categoryIds: [], note: '', updatedAt: 0 };
    const categoryIds = [...cur.categoryIds];
    for (const c of m.categoryIds) {
      const id = remap.get(c);
      if (id && !categoryIds.includes(id)) { categoryIds.push(id); report.assignmentsAdded++; }
    }
    let note = cur.note, updatedAt = cur.updatedAt;
    if (m.note && m.note !== cur.note) {
      if (!cur.note || m.updatedAt > cur.updatedAt) {
        note = m.note; updatedAt = Math.max(updatedAt, m.updatedAt); report.notesAdded++;
      } else report.notesSkipped++;
    }
    videos[vid] = { categoryIds, note, updatedAt };
  }
  return { meta: { categories, videos }, report };
}
