import { translatorFor } from '#app/lib/messages/__tests__/fixtures';
import { pl } from '..';

describe('apps/client/web: pl channelPage', () => {
  const { t } = translatorFor('pl', { pl });

  it.each([
    { key: 'channelPage.seeAll', args: undefined, expected: 'Zobacz wszystkie' },
    {
      key: 'channelPage.previewing',
      args: { audience: 'visitor' },
      expected: 'Podgląd wersji roboczej jako nowy widz',
    },
    { key: 'channelPage.playlistVideos', args: { count: 1 }, expected: '1 film' },
    { key: 'channelPage.playlistVideos', args: { count: 3 }, expected: '3 filmy' },
    { key: 'channelPage.playlistVideos', args: { count: 5 }, expected: '5 filmów' },
    { key: 'channelPage.liveStatus', args: { status: 'ENDED' }, expected: 'Zakończona transmisja' },
  ] as const)('writes $key', ({ key, args, expected }) => {
    expect(t(key, ...(args ? [args] : []))).toEqual({ ok: true, value: expected });
  });
});
