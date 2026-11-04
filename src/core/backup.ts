import { emptyMeta, sanitizeMeta } from './meta';
import { remainingSec, statusOf } from './time';
import type { Meta, Video } from './types';

export const BACKUP_SCHEMA = 'latertidy-backup';

export function toJson(videos: readonly Video[], meta: Meta, now = Date.now()): string {
  return JSON.stringify({
    schema: BACKUP_SCHEMA,
    version: 1,
    exportedAt: new Date(now).toISOString(),
    meta,
    videos: videos.map((v) => ({
      id: v.id, title: v.title, channel: v.channel, channelId: v.channelId,
      lengthSec: v.lengthSec, watchedPct: v.pct, status: statusOf(v),
      remainingSec: remainingSec(v), published: v.ageRaw,
      url: `https://www.youtube.com/watch?v=${v.id}`,
    })),
  }, null, 2);
}

/** Quotes a CSV cell and defuses spreadsheet formulas in user-controlled text. */
function cell(value: string | number | null): string {
  let s = value == null ? '' : String(value);
  if (typeof value === 'string' && /^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv(videos: readonly Video[], meta: Meta): string {
  const names = new Map(meta.categories.map((c) => [c.id, c.name]));
  const header = ['video_id', 'title', 'channel', 'length_sec', 'remaining_sec', 'watched_pct', 'status', 'published', 'url', 'categories', 'note'];
  const rows = videos.map((v) => {
    const m = meta.videos[v.id];
    const cats = (m?.categoryIds ?? []).map((c) => names.get(c)).filter(Boolean).join('; ');
    return [v.id, v.title, v.channel, v.lengthSec, remainingSec(v), v.pct, statusOf(v), v.ageRaw,
      `https://www.youtube.com/watch?v=${v.id}`, cats, m?.note ?? ''].map(cell).join(',');
  });
  return [header.join(','), ...rows].join('\r\n') + '\r\n';
}

/** Returns validated meta from backup text, or null when it isn't a LaterTidy backup. */
export function parseBackup(text: string): Meta | null {
  let data: any;
  try { data = JSON.parse(text); } catch { return null; }
  if (data?.schema !== BACKUP_SCHEMA || data.version !== 1) return null;
  return sanitizeMeta(data.meta ?? emptyMeta());
}
