export type LiveState = 'live' | 'upcoming' | null;
export type Status = 'notStarted' | 'inProgress' | 'finished' | 'unavailable' | 'live';

export interface Video {
  id: string;
  setVideoId: string;
  title: string;
  channel: string;
  /** "UC…" id; absent on collaborations, which group by channel name. */
  channelId: string | null;
  channelUrl: string | null;
  lengthSec: number | null;
  lengthText: string;
  /** 0–100 from the resume overlay. */
  pct: number;
  /** Playback-status overlay present. */
  watched: boolean;
  playable: boolean;
  live: LiveState;
  thumb: string;
  ageRaw: string;
  viewsRaw: string;
  /** Best-effort epoch ms from the localized age text. */
  publishedAt: number | null;
  firstSeenAt: number;
}

export interface Snapshot {
  v: 1;
  savedAt: number;
  videos: Video[];
  canReorder: boolean;
  isEditable: boolean;
}

export interface YtConfig {
  apiKey: string;
  clientVersion: string;
  context: unknown;
  sessionIndex: string;
  delegatedSessionId: string;
  datasyncId: string;
  visitorData: string;
  loggedIn: boolean;
  hl: string;
}

export interface Category { id: string; name: string; color: string }
export interface VideoMeta { categoryIds: string[]; note: string; updatedAt: number }
export interface Meta { categories: Category[]; videos: Record<string, VideoMeta> }

export type SortKey = 'youtube' | 'reverse' | 'shortest' | 'longest' | 'leastRemaining'
  | 'channel' | 'newest' | 'oldest';

export interface PlaylistOption {
  id: string; title: string; privacy: string; containsSelected: boolean;
}

export interface Settings { autoOpen: boolean; view: 'grid' | 'list'; sort: SortKey }
