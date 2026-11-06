import { lowestRendition } from '../lowest-rendition';
import { HIGH_URL, LOW_URL, savableVideo } from './saved-fixtures';

describe('apps/client/web: lowestRendition', () => {
  it('picks the smallest finished rendition with its bandwidth and size', () => {
    expect(lowestRendition(savableVideo())).toEqual({
      playlistUrl: LOW_URL,
      bandwidth: 364000,
      width: 426,
      height: 240,
    });
  });

  it.each([
    {
      name: 'skips a rendition still encoding',
      renditions: [
        { name: '240p', status: 'RUNNING', playlistUrl: LOW_URL },
        { name: '720p', status: 'DONE', playlistUrl: HIGH_URL },
      ],
      expected: HIGH_URL,
    },
    {
      name: 'skips a rendition with no playlist',
      renditions: [
        { name: '240p', status: 'DONE' },
        { name: '720p', status: 'DONE', playlistUrl: HIGH_URL },
      ],
      expected: HIGH_URL,
    },
    {
      name: 'takes the first one when the ladder is unknown',
      renditions: [
        { name: 'a', status: 'DONE', playlistUrl: HIGH_URL },
        { name: 'b', status: 'DONE', playlistUrl: LOW_URL },
      ],
      ladder: [],
      expected: HIGH_URL,
    },
    {
      name: 'finds nothing when none is finished',
      renditions: [{ name: '240p', status: 'PENDING', playlistUrl: LOW_URL }],
      expected: undefined,
    },
  ])('$name', ({ renditions, ladder, expected }) => {
    expect(
      lowestRendition(savableVideo({ renditions, ...(ladder && { ladder }) }))?.playlistUrl
    ).toBe(expected);
  });

  it('assumes a bandwidth when the ladder gives no bitrate', () => {
    const found = lowestRendition(
      savableVideo({ ladder: [{ name: '240p', width: 426, height: 240 }] })
    );

    expect(found?.bandwidth).toBe(800000);
  });
});
