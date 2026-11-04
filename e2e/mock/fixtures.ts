/**
 * Synthetic YouTube data for e2e tests. Everything here is invented: channels, titles, ids.
 * Video ids all start with `LbM` so a stray one in a report is easy to recognise as fake.
 */

export interface Text { simpleText: string }
export interface Run { text: string; navigationEndpoint?: Record<string, unknown> }
export interface Runs { runs: Run[] }
export interface Thumbnail { url: string; width: number; height: number }

export type ThumbnailOverlay =
  | { thumbnailOverlayTimeStatusRenderer: { style: 'DEFAULT' | 'LIVE'; text: Text } }
  | { thumbnailOverlayResumePlaybackRenderer: { percentDurationWatched: number } }
  | { thumbnailOverlayPlaybackStatusRenderer: { texts: Text[] } };

export interface PlaylistVideoRenderer {
  videoId: string;
  setVideoId: string;
  thumbnail: { thumbnails: Thumbnail[] };
  title: Runs;
  index: Text;
  shortBylineText?: Runs;
  lengthText?: Text;
  lengthSeconds?: string;
  navigationEndpoint: Record<string, unknown>;
  isPlayable: boolean;
  menu: Record<string, unknown>;
  thumbnailOverlays: ThumbnailOverlay[];
  videoInfo: Runs;
}

export type PlaylistItem = { playlistVideoRenderer: PlaylistVideoRenderer } | { continuationItemRenderer: unknown };

export interface MockPlaylist { playlistId: string; title: string }

export type CookieVariant = 'sapisid' | 'secure3p' | 'none';

export interface PageOptions {
  dark?: boolean;
  /** Default true. */
  loggedIn?: boolean;
  /** Default true. Shown as `data-can-reorder` on the list; the API value comes from installMock. */
  canReorder?: boolean;
  /** Default 'it'. */
  hl?: string;
  /** Default 'test-datasync||'. Change it to simulate another account. */
  datasyncId?: string;
  /** Default 'playlist'. */
  kind?: 'playlist' | 'watch' | 'home';
  /** Rows for the classic-looking list. Default: 8 generated videos. */
  videos?: PlaylistVideoRenderer[];
}

export const PAGE_SIZE = 100;
const CLIENT_VERSION = '2.20261030.02.00';

const CHANNELS = [
  'Officina del Martedì', 'Lentezza Applicata', 'Cartografia Minima', 'Bottega del Fermento', 'Quiet Bench Workshop',
  'Appunti di Geologia Urbana', 'Low Tide Lectures', 'Pixel in Cantina', 'Fili e Saldature', 'The Patient Compiler',
  'Storie di Ferrovie Secondarie', 'Mappe Sbagliate', 'Harbor Street Kitchen', 'Radio Ponte Vecchio Immaginario',
  'Slow Orbit Science', 'Il Quaderno a Quadretti', 'Tinfoil Synth Club', 'Passi in Quota', 'Numeri Gentili',
  'Marginalia Studio', 'Caffè e Teoremi', 'Backyard Beam Engine', 'Sartoria Digitale', 'Northfield Repair Log',
  'Ortaggi Ostinati',
] as const;

const TITLES_IT = [
  'Come fare il ragù in {n} ore senza errori', 'Perché le città italiane hanno i portici', 'Ho riparato una radio del {year}',
  'Guida completa al caffè in moka', 'La vera storia delle ferrovie di {place}', 'Pane a lievitazione lenta: tutto quello che serve',
  '{n} errori da evitare quando impari {skill}', 'Cosa succede davvero dentro un motore elettrico', 'Un giorno a {place} con {n} euro',
  'Il mistero del ponte di {place}', 'Più semplice di quanto pensi: {skill} da zero', 'Restauro di una bicicletta del {year}, parte {n}',
  'Perché il cielo è più scuro in quota', 'La città che non esiste sulle mappe', 'Trekking invernale sopra {place}: itinerario e attrezzatura',
  'Lezione {n}: introduzione a {skill}', 'Quanto costa davvero vivere a {place}', 'Dolci di Carnevale fatti in casa, ricetta della tradizione',
  'Tre modi di usare la lievitazione a freddo', 'Ho costruito un tavolo con {n} assi di recupero',
  'Il metodo più lento per imparare {skill} (e perché funziona)', 'Geologia del Po spiegata in {n} minuti', 'Sagre, castelli e silenzio: l’autunno a {place}',
];
const TITLES_EN = [
  'Building a {n}-key mechanical keyboard from scratch', 'Why bridges hum in the wind', 'The complete beginner guide to {skill}',
  'I restored a {year} tube amplifier', '{n} things nobody tells you about {skill}', 'A slow walk through {place} in autumn',
  'How sourdough actually works', 'What happens inside a lithium cell', 'Lecture {n}: an honest introduction to {skill}',
  'Fixing a broken sewing machine from {year}', 'The map that was wrong for {n} years', 'Live coding a tiny compiler, part {n}',
  'Why old trains sound like that', 'Weeknight dinners in under {n} minutes', 'Everything I learned from a year of {skill}',
  'Making a telescope mirror by hand', 'The strange economics of small harbors', 'Ambient mix for reading, {n} hours',
];
const PLACES = ['Pontelungo', 'Valdarena', 'Roccaforte Bassa', 'Castelbruno', 'Sant’Elia al Lago', 'Porto Nebbia', 'Montegrigio', 'Lower Wexcombe', 'Hollowmere'];
const SKILLS_IT = ['saldare', 'la fotografia analogica', 'il disegno tecnico', 'la teoria musicale', 'la sartoria', 'Rust', 'il tedesco'];
const SKILLS_EN = ['soldering', 'film photography', 'music theory', 'woodworking', 'bookbinding', 'Rust', 'German'];
const AGES = ['2 days ago', '3 days ago', '6 days ago', '1 week ago', '2 weeks ago', '3 weeks ago', '1 month ago', '4 months ago', '8 months ago', '1 year ago', '3 years ago'];
const VIEWS = ['412 visualizzazioni', '3893 visualizzazioni', '12.345 visualizzazioni', '87.210 visualizzazioni', '352.018 visualizzazioni', '1,2 Mln di visualizzazioni', '4,7 Mln di visualizzazioni'];
const ID_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';

/** The five "other" playlists offered by get_add_to_playlist. */
export const MOCK_PLAYLISTS: readonly MockPlaylist[] = [
  { playlistId: 'PLmock0000000000000000000000000001', title: 'Da rivedere' },
  { playlistId: 'PLmock0000000000000000000000000002', title: 'Ricette da provare' },
  { playlistId: 'PLmock0000000000000000000000000003', title: 'Workshop notes' },
  { playlistId: 'PLmock0000000000000000000000000004', title: 'Viaggi 2027' },
  { playlistId: 'PLmock0000000000000000000000000005', title: 'Long reads, but video' },
];

function rngFrom(seed: number): () => number {
  let a = seed | 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Small stable string hash, used for seeds and thumbnail colours. */
export function hashString(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return h >>> 0;
}

const pick = <T,>(items: readonly T[], r: () => number): T => items[Math.floor(r() * items.length)] as T;

const randomString = (length: number, chars: string, r: () => number) => {
  let out = '';
  for (let i = 0; i < length; i++) out += chars[Math.floor(r() * chars.length)];
  return out;
};

/** Zipf-like pick, so a few channels own much of the list. */
function pickChannel(r: () => number): number {
  const weights = CHANNELS.map((_, i) => 1 / (i + 1));
  let left = r() * weights.reduce((a, b) => a + b, 0);
  for (let i = 0; i < weights.length; i++) {
    left -= weights[i] as number;
    if (left <= 0) return i;
  }
  return 0;
}

/** Log-normal around 12 minutes, clamped to 30s..4h, so a histogram has a natural shape. */
function pickDuration(r: () => number): number {
  const z = Math.sqrt(-2 * Math.log(1 - r())) * Math.cos(2 * Math.PI * r());
  return Math.round(Math.min(14400, Math.max(30, Math.exp(Math.log(720) + 1.05 * z))));
}

function pickTitle(r: () => number): string {
  const italian = r() < 0.65;
  const skills = italian ? SKILLS_IT : SKILLS_EN;
  return pick(italian ? TITLES_IT : TITLES_EN, r)
    .replace('{n}', String(2 + Math.floor(r() * 11)))
    .replace('{year}', String(1948 + Math.floor(r() * 45)))
    .replace('{place}', pick(PLACES, r))
    .replace('{skill}', pick(skills, r));
}

export function formatLength(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor(seconds / 60) % 60;
  const s = String(seconds % 60).padStart(2, '0');
  return h ? `${h}:${String(m).padStart(2, '0')}:${s}` : `${m}:${s}`;
}

const channelRun = (index: number): Run => {
  const text = CHANNELS[index] as string;
  const handle = `/@${text.normalize('NFD').replace(/[^A-Za-z]/g, '').toLowerCase()}-mock`;
  return {
    text,
    navigationEndpoint: {
      commandMetadata: { webCommandMetadata: { url: handle, webPageType: 'WEB_PAGE_TYPE_CHANNEL', apiUrl: '/youtubei/v1/browse' } },
      browseEndpoint: { browseId: `UCmock${String(index).padStart(18, '0')}`, canonicalBaseUrl: handle },
    },
  };
};

const collabRun = (index: number): Run => ({
  text: `${CHANNELS[index]} e altri 2`,
  navigationEndpoint: {
    showDialogCommand: {
      panelLoadingStrategy: {
        inlineContent: { dialogViewModel: { header: { dialogHeaderViewModel: { headline: { content: 'Collaboratori' } } } } },
      },
    },
  },
});

const thumbnails = (videoId: string): Thumbnail[] =>
  ([[168, 94], [196, 110], [246, 138], [336, 188]] as const).map(([width, height]) => ({
    url: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg?sqp=mock${width}`, width, height,
  }));

const removeMenu = {
  menuRenderer: {
    items: [{ menuServiceItemRenderer: { text: { runs: [{ text: 'Rimuovi da Guarda più tardi' }] }, icon: { iconType: 'DELETE' } } }],
  },
};

/**
 * Deterministic `playlistVideoRenderer` objects (the inner object, not the `{playlistVideoRenderer}`
 * wrapper). Same (n, seed) gives the same list. Rates are approximate: about 3% collabs, 12% with
 * resume progress, 1% private, 1% live, so assert on them with a list of a few hundred videos.
 */
export function makeVideos(n: number, seed = 1): PlaylistVideoRenderer[] {
  const r = rngFrom(seed);
  const seen = new Set<string>();
  const titleUses = new Map<string, number>();
  const uniqueTitle = (title: string) => {
    const uses = (titleUses.get(title) ?? 0) + 1;
    titleUses.set(title, uses);
    return uses === 1 ? title : `${title} #${uses}`;
  };
  const out: PlaylistVideoRenderer[] = [];
  while (out.length < n) {
    const videoId = `LbM${randomString(8, ID_CHARS, r)}`;
    if (seen.has(videoId)) continue;
    seen.add(videoId);
    const setVideoId = randomString(16, '0123456789ABCDEF', r);
    const position = out.length;
    const roll = r();
    const isPrivate = roll < 0.01;
    const isLive = !isPrivate && roll < 0.02;
    const channel = pickChannel(r);
    const isCollab = r() < 0.03;
    const seconds = pickDuration(r);
    const titleText = uniqueTitle(pickTitle(r));
    const age = pick(AGES, r);
    const views = pick(VIEWS, r);
    const resume = r() < 0.12;
    const resumeFull = r() < 0.25;
    const resumePct = 3 + Math.floor(r() * 95);
    const navigationEndpoint = {
      commandMetadata: { webCommandMetadata: { url: `/watch?v=${videoId}&list=WL&index=${position + 1}`, webPageType: 'WEB_PAGE_TYPE_WATCH' } },
      watchEndpoint: { videoId, playlistId: 'WL', index: position },
    };
    const video: PlaylistVideoRenderer = {
      videoId,
      setVideoId,
      thumbnail: { thumbnails: thumbnails(videoId) },
      title: { runs: [{ text: isPrivate ? '[Video privato]' : titleText }] },
      index: { simpleText: String(position + 1) },
      navigationEndpoint,
      isPlayable: !isPrivate,
      menu: removeMenu,
      thumbnailOverlays: [],
      videoInfo: { runs: [] },
    };
    if (isPrivate) {
      video.thumbnailOverlays.push({ thumbnailOverlayTimeStatusRenderer: { style: 'DEFAULT', text: { simpleText: '' } } });
    } else if (isLive) {
      video.shortBylineText = { runs: [channelRun(channel)] };
      video.thumbnailOverlays.push({ thumbnailOverlayTimeStatusRenderer: { style: 'LIVE', text: { simpleText: 'LIVE' } } });
      video.videoInfo = { runs: [{ text: '1284 spettatori' }] };
    } else {
      const length = formatLength(seconds);
      video.shortBylineText = { runs: [isCollab ? collabRun(channel) : channelRun(channel)] };
      video.lengthText = { simpleText: length };
      video.lengthSeconds = String(seconds);
      video.videoInfo = { runs: [{ text: views }, { text: ' • ' }, { text: age }] };
      video.thumbnailOverlays.push({ thumbnailOverlayTimeStatusRenderer: { style: 'DEFAULT', text: { simpleText: length } } });
      if (resume) {
        video.thumbnailOverlays.push({
          thumbnailOverlayResumePlaybackRenderer: { percentDurationWatched: resumeFull ? 100 : resumePct },
        });
        if (resumeFull) video.thumbnailOverlays.push({ thumbnailOverlayPlaybackStatusRenderer: { texts: [{ simpleText: 'GUARDATO' }] } });
      }
    }
    out.push(video);
  }
  return out;
}

export const continuationToken = (offset: number) => `mock-continuation-${offset}`;

export function parseContinuationToken(token: unknown): number | null {
  const match = typeof token === 'string' ? /^mock-continuation-(\d+)$/.exec(token) : null;
  return match ? Number(match[1]) : null;
}

/** Item that YouTube appends to a page when more videos follow. */
export const continuationItem = (token: string) => ({
  continuationItemRenderer: {
    trigger: 'CONTINUATION_TRIGGER_ON_ITEM_SHOWN',
    continuationEndpoint: {
      commandExecutorCommand: {
        commands: [{ playlistVotingRefreshPopupCommand: {} }, { continuationCommand: { token, request: 'CONTINUATION_REQUEST_TYPE_BROWSE' } }],
      },
    },
  },
});

/** One page of items starting at `offset`. Index numbers follow the list's current order. */
export function pageItems(videos: readonly PlaylistVideoRenderer[], offset: number, pageSize = PAGE_SIZE): PlaylistItem[] {
  const items: PlaylistItem[] = videos.slice(offset, offset + pageSize).map((video, i) => ({
    playlistVideoRenderer: { ...video, index: { simpleText: String(offset + i + 1) } },
  }));
  const next = offset + pageSize;
  if (next < videos.length) items.push(continuationItem(continuationToken(next)));
  return items;
}

/** Response to `{browseId:'VLWL'}`. */
export function browseResponse(videos: readonly PlaylistVideoRenderer[], opts: { canReorder?: boolean; pageSize?: number } = {}) {
  return {
    responseContext: {},
    contents: {
      twoColumnBrowseResultsRenderer: {
        tabs: [{
          tabRenderer: {
            selected: true,
            content: {
              sectionListRenderer: {
                contents: [{
                  itemSectionRenderer: {
                    contents: [{
                      playlistVideoListRenderer: {
                        contents: pageItems(videos, 0, opts.pageSize),
                        playlistId: 'WL',
                        isEditable: true,
                        canReorder: opts.canReorder ?? true,
                        sortFilterMenu: { sortFilterSubMenuRenderer: { subMenuItems: [] } },
                      },
                    }],
                  },
                }],
              },
            },
          },
        }],
      },
    },
  };
}

/** Response to `{continuation}`. */
export function continuationResponse(videos: readonly PlaylistVideoRenderer[], offset: number, pageSize = PAGE_SIZE) {
  return {
    responseContext: {},
    onResponseReceivedActions: [{ appendContinuationItemsAction: { continuationItems: pageItems(videos, offset, pageSize) } }],
  };
}

/** Browse response for a signed-out session: no playlist in it. */
export const signedOutBrowseResponse = () => ({
  responseContext: {},
  alerts: [{ alertRenderer: { type: 'ERROR', text: { simpleText: 'Devi accedere per vedere questa playlist.' } } }],
});

/** Response to `playlist/get_add_to_playlist`. `contains` lists playlists that hold every selected video. */
export function addToPlaylistResponse(playlists: readonly MockPlaylist[] = MOCK_PLAYLISTS, contains: ReadonlySet<string> = new Set()) {
  return {
    responseContext: {},
    contents: [{
      addToPlaylistRenderer: {
        playlists: playlists.map(({ playlistId, title }) => ({
          playlistAddToOptionRenderer: {
            playlistId,
            title: { simpleText: title },
            privacy: 'PRIVATE',
            containsSelectedVideos: contains.has(playlistId) ? 'ALL' : 'NONE',
          },
        })),
      },
    }],
  };
}

/** Cookies for `context.addCookies`. 'sapisid' sets SAPISID, 'secure3p' sets only __Secure-3PAPISID. */
export function sessionCookies(variant: CookieVariant) {
  if (variant === 'none') return [];
  const name = variant === 'sapisid' ? 'SAPISID' : '__Secure-3PAPISID';
  return [{ name, value: 'test', domain: '.youtube.com', path: '/', secure: true, sameSite: 'None' as const }];
}

/** Generated thumbnail, an abstract gradient with no text, served for any i.ytimg.com URL. */
export function thumbnailSvg(key: string): string {
  const h = hashString(key);
  const hue = h % 360;
  const second = (hue + 40 + ((h >>> 9) % 80)) % 360;
  const cx = 60 + ((h >>> 3) % 220);
  const cy = 30 + ((h >>> 13) % 130);
  const size = 40 + ((h >>> 17) % 60);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="336" height="188" viewBox="0 0 336 188">`
    + `<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="hsl(${hue} 55% 42%)"/>`
    + `<stop offset="1" stop-color="hsl(${second} 60% 28%)"/></linearGradient></defs>`
    + `<rect width="336" height="188" fill="url(#g)"/>`
    + `<circle cx="${cx}" cy="${cy}" r="${size}" fill="#fff" fill-opacity=".14"/>`
    + `<circle cx="${336 - cx}" cy="${188 - cy}" r="${size + 30}" fill="#000" fill-opacity=".12"/></svg>`;
}

const escapeHtml = (text: string) => text.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c] as string);
const scriptJson = (value: unknown) => JSON.stringify(value).replace(/</g, '\\u003c');

function listMarkup(videos: readonly PlaylistVideoRenderer[], canReorder: boolean): string {
  const rows = videos.map((v) => `
      <ytd-playlist-video-renderer data-video-id="${escapeHtml(v.videoId)}">
        <img alt="" width="120" height="68" src="${escapeHtml(v.thumbnail.thumbnails[0]?.url ?? '')}">
        <div><a href="/watch?v=${escapeHtml(v.videoId)}&amp;list=WL">${escapeHtml(v.title.runs[0]?.text ?? '')}</a>
        <p>${escapeHtml(v.shortBylineText?.runs[0]?.text ?? '')} ${escapeHtml(v.lengthText?.simpleText ?? '')}</p></div>
      </ytd-playlist-video-renderer>`).join('');
  return `<h1>Guarda più tardi</h1>
    <ytd-playlist-video-list-renderer data-can-reorder="${canReorder}">${rows}
    </ytd-playlist-video-list-renderer>`;
}

/** A minimal classic-layout YouTube document, enough for the extension's content scripts. */
export function pageHtml(options: PageOptions = {}): string {
  const { dark = false, loggedIn = true, canReorder = true, hl = 'en', datasyncId = 'test-datasync||', kind = 'playlist' } = options;
  const data: Record<string, unknown> = {
    INNERTUBE_API_KEY: 'test-key',
    INNERTUBE_CLIENT_VERSION: CLIENT_VERSION,
    INNERTUBE_CONTEXT: { client: { hl, gl: 'US', clientName: 'WEB', clientVersion: CLIENT_VERSION }, user: {}, request: {}, clickTracking: {} },
    SESSION_INDEX: '0',
    VISITOR_DATA: 'visitor',
    LOGGED_IN: loggedIn,
    HL: hl,
    GL: 'IT',
  };
  if (loggedIn) data.DATASYNC_ID = datasyncId;
  const main = kind === 'playlist'
    ? listMarkup(options.videos ?? makeVideos(8, 1), canReorder)
    : kind === 'watch' ? '<div id="player" style="aspect-ratio:16/9;max-width:640px;background:#000"></div>' : '<p>Home</p>';
  return `<!doctype html>
<html lang="${escapeHtml(hl)}"${dark ? ' dark="true"' : ''}>
<head>
<meta charset="utf-8">
<title>Guarda più tardi - YouTube</title>
<script>
  window.ytcfg = { data_: ${scriptJson(data)}, get(key, fallback) { return key in this.data_ ? this.data_[key] : fallback; } };
  window.__pageKeys = [];
  document.addEventListener('keydown', (event) => window.__pageKeys.push(event.key));
</script>
<style>
  html { color-scheme: light; background: #fff; color: #0f0f0f; font: 14px/1.4 Roboto, Arial, sans-serif; }
  html[dark] { color-scheme: dark; background: #0f0f0f; color: #f1f1f1; }
  body { margin: 0; }
  a { color: inherit; text-decoration: none; }
  p { margin: 4px 0; opacity: .7; }
  ytd-masthead { display: flex; justify-content: flex-end; height: 56px; padding: 0 16px; align-items: center; }
  #end, #buttons { display: flex; align-items: center; gap: 8px; }
  ytd-page-manager { display: block; padding: 16px 24px; }
  ytd-playlist-video-list-renderer { display: block; max-width: 800px; }
  ytd-playlist-video-renderer { display: flex; gap: 12px; padding: 6px 0; }
</style>
</head>
<body>
<ytd-app>
<ytd-masthead><div id="end"><div id="masthead-skeleton-icons"></div><div id="buttons"></div></div></ytd-masthead>
<ytd-page-manager>${main}</ytd-page-manager>
</ytd-app>
</body>
</html>`;
}
