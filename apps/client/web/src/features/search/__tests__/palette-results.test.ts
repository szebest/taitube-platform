import { CHANNEL_ID } from '@vp/web-testing';

import { groupPaletteResults, paletteResultKey } from '../palette-results';
import { channelHit, playlistResult, videoResult } from './search-fixtures';

const SUGGESTED_CHANNEL = {
  type: 'channel' as const,
  text: 'React Conf',
  channelId: CHANNEL_ID,
  handle: 'reactconf',
  avatarUrl: null,
};

describe('apps/client/web: palette results', () => {
  it('sorts hits and suggestions into groups, in the order each arrived', () => {
    const groups = groupPaletteResults(
      [videoResult(), playlistResult()],
      [{ type: 'query', text: 'react hooks' }]
    );

    expect(
      Object.fromEntries(Object.entries(groups).map(([name, list]) => [name, list.length]))
    ).toEqual({
      videos: 1,
      channels: 0,
      playlists: 1,
      queries: 1,
    });
  });

  it('lists a channel found both ways once, as the suggestion', () => {
    const { channels } = groupPaletteResults([channelHit()], [SUGGESTED_CHANNEL]);

    expect(channels).toEqual([
      {
        kind: 'channel',
        id: CHANNEL_ID,
        handle: 'reactconf',
        name: 'React Conf',
        avatarUrl: null,
      },
    ]);
  });

  it('keeps the subscriber count of a channel found only by search', () => {
    const { channels } = groupPaletteResults([channelHit()], []);

    expect(channels).toMatchObject([{ kind: 'channel', subscriberCount: 4200 }]);
  });

  it.each([
    { result: { kind: 'query' as const, text: 'lofi' }, key: 'query:lofi' },
    {
      result: { kind: 'channel' as const, id: 'c1', handle: 'h', name: 'n', avatarUrl: null },
      key: 'channel:c1',
    },
  ])('keys $key', ({ result, key }) => {
    expect(paletteResultKey(result)).toBe(key);
  });

  it('keys a video and a playlist by their kind and id', () => {
    const { videos, playlists } = groupPaletteResults([videoResult(), playlistResult()], []);

    expect([...videos, ...playlists].map(paletteResultKey)).toEqual([
      expect.stringMatching(/^video:/),
      expect.stringMatching(/^playlist:/),
    ]);
  });
});
