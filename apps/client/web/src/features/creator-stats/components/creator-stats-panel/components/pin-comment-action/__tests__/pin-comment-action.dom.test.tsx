import { screen, waitFor, within } from '@testing-library/react';
import { listVideoComments, pinComment, unpinComment } from '@vp/api-contracts';
import { account, comment, mockEndpoint } from '@vp/web-testing';
import { HttpResponse } from 'msw/http';
import { renderPanel } from '#app/features/creator-stats/__tests__/render-panel';

vi.mock(import('#app/components/player/taitube-player/taitube-player'), async () => ({
  TaitubePlayer: (await import('#app/__tests__/stub-player')).StubPlayer,
}));

const id = (n: number) => `0190c3a0-5e1d-7000-8000-00000000d${n}00`;
const THREAD = [
  comment({ id: id(1), content: 'Pinned already', isPinned: true, likeCount: 1 }),
  comment({ id: id(2), content: 'Least liked', likeCount: 2 }),
  comment({ id: id(3), content: 'Most liked', likeCount: 40 }),
  comment({ id: id(4), content: 'A reply', parentId: id(3), likeCount: 99 }),
];

async function openPins() {
  const pinned: string[] = [];
  const unpinned: string[] = [];
  const rendered = await renderPanel({
    viewer: account(),
    handlers: [
      mockEndpoint(listVideoComments, () =>
        HttpResponse.json({ items: THREAD, nextCursor: null, total: THREAD.length })
      ),
      mockEndpoint(pinComment, ({ params }) => {
        pinned.push(String(params.id));
        return HttpResponse.json(comment({ id: String(params.id), isPinned: true }));
      }),
      mockEndpoint(unpinComment, ({ params }) => {
        unpinned.push(String(params.id));
        return HttpResponse.json(comment({ id: String(params.id) }));
      }),
    ],
  });
  await rendered.user.click(await screen.findByRole('button', { name: 'Pin a comment' }));
  return { ...rendered, pinned, unpinned, list: await screen.findByRole('dialog') };
}

describe('apps/client/web: PinCommentAction', () => {
  it('lists the pinned comment first, then the most liked ones, roots only', async () => {
    const { list } = await openPins();

    const rows = await within(list).findAllByRole('listitem');

    expect(rows.map((row) => row.textContent)).toEqual([
      'Pinned alreadyUnpin',
      'Most likedPin',
      'Least likedPin',
    ]);
  });

  it('pins a comment and unpins the pinned one through the comment endpoints', async () => {
    const { user, list, pinned, unpinned } = await openPins();

    const rows = await within(list).findAllByRole('listitem');
    await user.click(within(rows[1] as HTMLElement).getByRole('button', { name: 'Pin' }));
    await user.click(within(rows[0] as HTMLElement).getByRole('button', { name: 'Unpin' }));

    await waitFor(() => expect(pinned).toEqual([id(3)]));
    await waitFor(() => expect(unpinned).toEqual([id(1)]));
  });
});
