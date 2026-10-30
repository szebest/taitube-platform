import type { Video } from '@vp/api-contracts';
import { video } from '@vp/web-testing';
import { http, HttpResponse } from 'msw/http';

export const CDN = 'https://cdn.taitube.test/videos/v1';
export const MASTER_URL = `${CDN}/master.m3u8`;
export const LOW_URL = `${CDN}/240p/index.m3u8`;
export const HIGH_URL = `${CDN}/720p/index.m3u8`;
export const POSTER_URL = `${CDN}/thumbs/poster.jpg`;

export const MEDIA_PLAYLIST = [
  '#EXTM3U',
  '#EXT-X-TARGETDURATION:10',
  '#EXTINF:10.0,',
  'seg_00000.ts',
  '#EXTINF:10.0,',
  'seg_00001.ts',
  '#EXTINF:10.0,',
  'seg_00002.ts',
  '#EXT-X-ENDLIST',
  '',
].join('\n');

export function savableVideo(overrides: Partial<Video> = {}): Video {
  return video({
    title: 'Launch day',
    playbackUrl: MASTER_URL,
    posterUrl: POSTER_URL,
    ladder: [
      { name: '720p', width: 1280, height: 720, videoKbps: 2500, audioKbps: 128 },
      { name: '240p', width: 426, height: 240, videoKbps: 300, audioKbps: 64 },
    ],
    renditions: [
      { name: '720p', status: 'DONE', playlistUrl: HIGH_URL },
      { name: '240p', status: 'DONE', playlistUrl: LOW_URL },
    ],
    ...overrides,
  });
}

export function cdnFetch(
  overrides: Record<string, Response | Error> = {},
  segmentBytes = 1000
): typeof fetch {
  const known: Record<string, Response | Error> = {
    [LOW_URL]: new Response(MEDIA_PLAYLIST),
    [POSTER_URL]: new Response('poster'),
    ...overrides,
  };
  return vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    const answer =
      known[url] ?? (url.endsWith('.ts') ? new Response('x'.repeat(segmentBytes)) : undefined);
    if (answer instanceof Error) {
      throw answer;
    }
    return answer?.clone() ?? new Response(null, { status: 404 });
  });
}

export function cdnHandlers() {
  return [
    http.get(LOW_URL, () => HttpResponse.text(MEDIA_PLAYLIST)),
    http.get(POSTER_URL, () => HttpResponse.text('poster')),
    http.get(`${CDN}/240p/:segment`, () => HttpResponse.text('x'.repeat(1000))),
  ];
}
