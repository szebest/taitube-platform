import { translatorFor } from '#app/lib/messages/__tests__/fixtures';

describe('apps/client/web: en channelPage', () => {
  const { t } = translatorFor('en');

  it.each([
    { key: 'channelPage.seeAll', args: undefined, expected: 'See all' },
    {
      key: 'channelPage.previewing',
      args: { audience: 'subscriber' },
      expected: 'Previewing the draft as a subscriber',
    },
    { key: 'channelPage.playlistVideos', args: { count: 1 }, expected: '1 video' },
    { key: 'channelPage.playlistVideos', args: { count: 4 }, expected: '4 videos' },
    { key: 'channelPage.liveStatus', args: { status: 'LIVE' }, expected: 'Live now' },
  ] as const)('writes $key', ({ key, args, expected }) => {
    expect(t(key, ...(args ? [args] : []))).toEqual({ ok: true, value: expected });
  });
});
