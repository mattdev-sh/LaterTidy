import type { Video } from '../src/core/types';

/** Synthetic renderer mirroring YouTube's playlistVideoRenderer keys. */
export function raw(id: string, over: Record<string, unknown> = {}) {
  return {
    videoId: id, setVideoId: `set-${id}`,
    thumbnail: { thumbnails: [168, 196, 246, 336].map((w) => ({ url: `https://i.ytimg.com/vi/${id}/${w}.jpg`, width: w, height: w * 0.56 })) },
    title: { runs: [{ text: `Title ${id}` }] },
    index: { simpleText: '1' },
    shortBylineText: { runs: [{ text: 'Canale Uno', navigationEndpoint: { browseEndpoint: { browseId: 'UCaaa', canonicalBaseUrl: '/@canaleuno' } } }] },
    lengthText: { simpleText: '10:00' },
    lengthSeconds: '600',
    isPlayable: true,
    videoInfo: { runs: [{ text: '12 Mln di visualizzazioni' }, { text: ' • ' }, { text: '3 gg fa' }] },
    thumbnailOverlays: [{ thumbnailOverlayTimeStatusRenderer: { style: 'DEFAULT', text: { simpleText: '10:00' } } }],
    ...over,
  };
}

export const item = (renderer: unknown) => ({ playlistVideoRenderer: renderer });

export const continuation = (token: string) => ({
  continuationItemRenderer: {
    continuationEndpoint: { commandExecutorCommand: { commands: [{ clickTrackingParams: 'x' }, { continuationCommand: { token, request: 'R' } }] } },
  },
});

export const initial = (contents: unknown[], extra: Record<string, unknown> = { isEditable: true, canReorder: false }) => ({
  contents: { twoColumnBrowseResultsRenderer: { tabs: [{ tabRenderer: { content: { sectionListRenderer: { contents: [{ itemSectionRenderer: { contents: [{
    playlistVideoListRenderer: { contents, ...extra },
  }] } }] } } } }] } },
});

export const nextPage = (items: unknown[]) => ({
  onResponseReceivedActions: [{ appendContinuationItemsAction: { continuationItems: items } }],
});

export function video(id: string, over: Partial<Video> = {}): Video {
  return {
    id, setVideoId: `set-${id}`, title: `Title ${id}`, channel: 'Canale', channelId: 'UCa', channelUrl: '/@a',
    lengthSec: 600, lengthText: '10:00', pct: 0, watched: false, playable: true, live: null, thumb: '',
    ageRaw: '3 gg fa', viewsRaw: '', publishedAt: 0, firstSeenAt: 0, ...over,
  };
}
