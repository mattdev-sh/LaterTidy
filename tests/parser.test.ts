import { describe, expect, it } from 'vitest';
import { findAll, parsePage, parsePlaylists, parseVideo } from '../src/core/parser';
import { continuation, initial, item, nextPage, raw } from './fixtures';

const NOW = Date.UTC(2026, 10, 3);

describe('parsePage', () => {
  it('reads the initial shape with flags and nested continuation', () => {
    const page = parsePage(initial([item(raw('aaaaaaaaaaa')), item(raw('bbbbbbbbbbb')), continuation('TOKEN1')]));
    expect(page.raws.map((r) => r.videoId)).toEqual(['aaaaaaaaaaa', 'bbbbbbbbbbb']);
    expect(page.continuation).toBe('TOKEN1');
    expect(page.canReorder).toBe(false);
    expect(page.isEditable).toBe(true);
  });

  it('reads continuation pages and stops at the last one', () => {
    const page = parsePage(nextPage([item(raw('ccccccccccc'))]));
    expect(page.raws).toHaveLength(1);
    expect(page.continuation).toBeNull();
    expect(page.canReorder).toBeNull();
  });

  it('tolerates a shape change around the renderers', () => {
    const moved = { somewhere: { new: [{ deep: [item(raw('ddddddddddd')), continuation('T2')] }] } };
    const page = parsePage(moved);
    expect(page.raws).toHaveLength(1);
    expect(page.continuation).toBe('T2');
  });

  it('returns nothing on junk', () => {
    expect(parsePage(null).raws).toEqual([]);
    expect(parsePage({ a: 1 }).continuation).toBeNull();
  });

  it('finds every value of a key without descending into matches', () => {
    expect(findAll({ a: [{ k: { k: 1 } }, { b: { k: 2 } }] }, 'k')).toEqual([{ k: 1 }, 2]);
  });
});

describe('parseVideo', () => {
  it('maps the fields', () => {
    const v = parseVideo(raw('aaaaaaaaaaa'), NOW)!;
    expect(v).toMatchObject({
      id: 'aaaaaaaaaaa', setVideoId: 'set-aaaaaaaaaaa', title: 'Title aaaaaaaaaaa', channel: 'Canale Uno',
      channelId: 'UCaaa', channelUrl: '/@canaleuno', lengthSec: 600, pct: 0, watched: false, playable: true,
      live: null, ageRaw: '3 gg fa', firstSeenAt: NOW,
    });
    expect(v.thumb).toContain('/336.jpg');
    expect(v.publishedAt).toBe(NOW - 3 * 86_400_000);
  });

  it('handles a collaboration with no browseEndpoint', () => {
    const v = parseVideo(raw('aaaaaaaaaaa', {
      shortBylineText: { runs: [{ text: 'Due Canali', navigationEndpoint: { showDialogCommand: {} } }] },
    }), NOW)!;
    expect(v.channelId).toBeNull();
    expect(v.channel).toBe('Due Canali');
  });

  it('marks an unavailable video', () => {
    const v = parseVideo(raw('aaaaaaaaaaa', { isPlayable: false, lengthSeconds: undefined, lengthText: undefined }), NOW)!;
    expect(v.playable).toBe(false);
    expect(v.lengthSec).toBeNull();
  });

  it('reads resume and watched overlays', () => {
    const v = parseVideo(raw('aaaaaaaaaaa', { thumbnailOverlays: [
      { thumbnailOverlayResumePlaybackRenderer: { percentDurationWatched: 37 } },
      { thumbnailOverlayPlaybackStatusRenderer: { texts: [{ simpleText: 'GUARDATO' }] } },
    ] }), NOW)!;
    expect(v.pct).toBe(37);
    expect(v.watched).toBe(true);
  });

  it('detects live and upcoming', () => {
    const live = (style: string) => ({ thumbnailOverlays: [{ thumbnailOverlayTimeStatusRenderer: { style } }] });
    expect(parseVideo(raw('aaaaaaaaaaa', live('LIVE')), NOW)!.live).toBe('live');
    expect(parseVideo(raw('aaaaaaaaaaa', live('UPCOMING')), NOW)!.live).toBe('upcoming');
    expect(parseVideo(raw('aaaaaaaaaaa', { upcomingEventData: {} }), NOW)!.live).toBe('upcoming');
  });

  it('falls back to lengthText when lengthSeconds is missing, and keeps firstSeen', () => {
    const v = parseVideo(raw('aaaaaaaaaaa', { lengthSeconds: undefined, lengthText: { simpleText: '1:02:03' } }), NOW, 123)!;
    expect(v.lengthSec).toBe(3723);
    expect(v.firstSeenAt).toBe(123);
  });

  it('rejects a renderer with no id', () => {
    expect(parseVideo({}, NOW)).toBeNull();
  });
});

it('parses playlist options', () => {
  const opts = parsePlaylists({ x: [
    { playlistAddToOptionRenderer: { playlistId: 'PL1', title: { simpleText: 'Uno' }, privacy: 'PRIVATE', containsSelectedVideos: 'NONE' } },
    { playlistAddToOptionRenderer: { playlistId: 'PL2', title: { runs: [{ text: 'Due' }] }, privacy: 'PUBLIC', containsSelectedVideos: 'ALL' } },
    { playlistAddToOptionRenderer: { playlistId: 'PL1', title: { simpleText: 'dup' } } },
  ] });
  expect(opts).toEqual([
    { id: 'PL1', title: 'Uno', privacy: 'PRIVATE', containsSelected: false },
    { id: 'PL2', title: 'Due', privacy: 'PUBLIC', containsSelected: true },
  ]);
});
