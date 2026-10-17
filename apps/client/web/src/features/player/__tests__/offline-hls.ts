import type Hls from 'hls.js';
import type * as HlsModule from 'hls.js';
import { act } from 'react';

const attached = new Map<HTMLMediaElement, Hls>();

/**
 * hls.js as a browser that plays HLS sees it, minus the network. This module imports hls.js only
 * lazily: the `vi.mock(import('hls.js'))` factory that loads it runs while hls.js is being mocked.
 */
export function offlineHls(original: typeof HlsModule): typeof HlsModule {
  class OfflineHls extends original.default {
    static override isSupported() {
      return true;
    }

    override attachMedia(media: HTMLMediaElement) {
      attached.set(media, this);
    }

    override loadSource() {}
  }

  return { ...original, default: OfflineHls };
}

export function attachedHls(video: HTMLVideoElement): Promise<Hls> {
  return vi.waitFor(() => {
    const hls = attached.get(video);
    if (!hls) throw new Error('the player attached no hls.js instance yet');
    return hls;
  });
}

/** The master lists one rendition per height, lowest first, and adaptive bitrate plays `playing`. */
export async function parseMaster(
  video: HTMLVideoElement,
  heights: readonly number[],
  playing: number
): Promise<Hls> {
  const { AttrList, Events, Level, LoadStats } = await import('hls.js');
  const hls = await attachedHls(video);
  const levels = heights.map(
    (height) =>
      new Level({
        attrs: new AttrList({}),
        url: `http://localhost:9000/public/videos/v1/hls/${height}p.m3u8`,
        name: `${height}p`,
        width: (height * 16) / 9,
        height,
        videoCodec: 'avc1.64001f',
        bitrate: height * 4_000,
      })
  );

  act(() => {
    hls.trigger(Events.MANIFEST_PARSED, {
      levels,
      audioTracks: [],
      subtitleTracks: [],
      sessionData: null,
      sessionKeys: null,
      firstLevel: 0,
      stats: new LoadStats(),
      audio: true,
      video: true,
      altAudio: false,
    });
    hls.trigger(Events.LEVEL_SWITCHED, { level: heights.indexOf(playing) });
  });
  return hls;
}
