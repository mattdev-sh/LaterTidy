import { parseAge } from './age';
import type { LiveState, PlaylistOption, Video } from './types';

type Any = any; // Raw InnerTube JSON: shapes are read defensively, never trusted.

/** Depth-first walk that collects every value stored under `key`. Does not descend into matches. */
export function findAll(root: unknown, key: string, out: Any[] = []): Any[] {
  const stack: unknown[] = [root];
  while (stack.length) {
    const node = stack.pop();
    if (!node || typeof node !== 'object') continue;
    if (Array.isArray(node)) {
      for (let i = node.length - 1; i >= 0; i--) stack.push(node[i]);
      continue;
    }
    const entries = Object.entries(node as object);
    for (let i = entries.length - 1; i >= 0; i--) {
      const [k, v] = entries[i]!;
      if (k === key) out.push(v); else stack.push(v);
    }
  }
  return out;
}

export function findFirst(root: unknown, key: string): Any | undefined {
  return findAll(root, key)[0];
}

export function textOf(node: Any): string {
  if (!node) return '';
  if (typeof node === 'string') return node;
  if (typeof node.simpleText === 'string') return node.simpleText;
  if (Array.isArray(node.runs)) return node.runs.map((r: Any) => r?.text ?? '').join('');
  return '';
}

function pickThumb(thumbs: Any): string {
  if (!Array.isArray(thumbs) || !thumbs.length) return '';
  const sized = thumbs.filter((t) => t?.url);
  sized.sort((a, b) => (a.width ?? 0) - (b.width ?? 0));
  const fit = sized.find((t) => (t.width ?? 0) >= 336) ?? sized[sized.length - 1];
  return fit?.url ?? '';
}

function parseLength(raw: Any): number | null {
  const direct = Number(raw.lengthSeconds);
  if (raw.lengthSeconds != null && Number.isFinite(direct) && direct > 0) return direct;
  const text = textOf(raw.lengthText);
  if (/^\d+(:\d{1,2}){1,2}$/.test(text)) {
    return text.split(':').reduce((sum, part) => sum * 60 + Number(part), 0);
  }
  return null;
}

function parseOverlays(raw: Any): { pct: number; watched: boolean; live: LiveState } {
  let pct = 0, watched = false, live: LiveState = null;
  const overlays = Array.isArray(raw.thumbnailOverlays) ? raw.thumbnailOverlays : [];
  for (const o of overlays) {
    const resume = o?.thumbnailOverlayResumePlaybackRenderer;
    if (resume) {
      const p = Number(resume.percentDurationWatched);
      if (Number.isFinite(p)) pct = Math.min(100, Math.max(0, p));
    }
    if (o?.thumbnailOverlayPlaybackStatusRenderer) watched = true;
    const style = o?.thumbnailOverlayTimeStatusRenderer?.style;
    if (style === 'LIVE') live = 'live';
    else if (style === 'UPCOMING') live = 'upcoming';
  }
  if (raw.upcomingEventData) live = 'upcoming';
  return { pct, watched, live };
}

export function parseVideo(raw: Any, now: number, firstSeen?: number): Video | null {
  if (!raw || typeof raw.videoId !== 'string') return null;
  const byline = raw.shortBylineText?.runs?.[0];
  const endpoint = byline?.navigationEndpoint;
  const browse = endpoint?.browseEndpoint;
  const channelId = typeof browse?.browseId === 'string' ? browse.browseId : null;
  const canonical = browse?.canonicalBaseUrl ?? endpoint?.commandMetadata?.webCommandMetadata?.url;
  const channelUrl = typeof canonical === 'string' ? canonical : channelId ? `/channel/${channelId}` : null;
  const info: Any[] = Array.isArray(raw.videoInfo?.runs) ? raw.videoInfo.runs : [];
  const ageRaw = info.length ? String(info[info.length - 1]?.text ?? '').trim() : '';
  const { pct, watched, live } = parseOverlays(raw);
  return {
    id: raw.videoId,
    setVideoId: typeof raw.setVideoId === 'string' ? raw.setVideoId : '',
    title: textOf(raw.title),
    channel: textOf(raw.shortBylineText),
    channelId,
    channelUrl,
    lengthSec: parseLength(raw),
    lengthText: textOf(raw.lengthText),
    pct,
    watched,
    // Only an explicit false means unavailable.
    playable: raw.isPlayable !== false,
    live,
    thumb: pickThumb(raw.thumbnail?.thumbnails),
    ageRaw,
    viewsRaw: info.length > 1 ? String(info[0]?.text ?? '').trim() : '',
    publishedAt: parseAge(ageRaw, now),
    firstSeenAt: firstSeen ?? now,
  };
}

export interface PageResult {
  raws: Any[];
  continuation: string | null;
  canReorder: boolean | null;
  isEditable: boolean | null;
  /** Total from the page header when one can be read. */
  total: number | null;
}

function findTotal(json: unknown): number | null {
  for (const key of ['numVideosText', 'stats', 'videoCountText']) {
    for (const node of findAll(json, key)) {
      const text = textOf(Array.isArray(node) ? node[0] : node);
      const digits = text.replace(/[^\d]/g, '');
      if (digits && /\d/.test(text)) return Number(digits);
    }
  }
  return null;
}

/** Generic page parser: works on initial and continuation responses alike. */
export function parsePage(json: unknown): PageResult {
  const raws = findAll(json, 'playlistVideoRenderer');
  // The continuation command is nested inside the last item; ignore any elsewhere in the page.
  const items = findAll(json, 'continuationItemRenderer');
  let continuation: string | null = null;
  for (let i = items.length - 1; i >= 0 && !continuation; i--) {
    const token = findFirst(items[i], 'continuationCommand')?.token;
    if (typeof token === 'string' && token) continuation = token;
  }
  const list = findFirst(json, 'playlistVideoListRenderer');
  return {
    raws,
    continuation,
    canReorder: typeof list?.canReorder === 'boolean' ? list.canReorder : null,
    isEditable: typeof list?.isEditable === 'boolean' ? list.isEditable : null,
    total: list ? findTotal(json) : null,
  };
}

export function parsePlaylists(json: unknown): PlaylistOption[] {
  const seen = new Set<string>();
  const out: PlaylistOption[] = [];
  for (const r of findAll(json, 'playlistAddToOptionRenderer')) {
    if (typeof r?.playlistId !== 'string' || seen.has(r.playlistId)) continue;
    seen.add(r.playlistId);
    out.push({
      id: r.playlistId,
      title: textOf(r.title),
      privacy: String(r.privacy ?? ''),
      containsSelected: r.containsSelectedVideos === 'ALL' || r.containsSelectedVideos === true,
    });
  }
  return out;
}
