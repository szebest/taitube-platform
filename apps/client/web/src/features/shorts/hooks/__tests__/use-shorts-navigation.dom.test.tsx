import { fireEvent, screen, waitFor } from '@testing-library/react';
import { getShorts } from '@vp/api-contracts';
import { mockEndpoint } from '@vp/web-testing';
import { HttpResponse } from 'msw/http';

import { renderShorts } from '#app/features/shorts/__tests__/render-shorts';
import { SHORTS, shortSummary } from '#app/features/shorts/__tests__/short-fixtures';

vi.mock(import('#app/features/player'), async (importOriginal) => ({
  ...(await importOriginal()),
  TaitubePlayer: (await import('#app/features/shorts/__tests__/stub-short-player')).StubShortPlayer,
}));

const LINKED = '0190c3a0-5e1d-7000-8000-00000000f099';

type User = Awaited<ReturnType<typeof renderShorts>>['user'];

async function moveDown(user: User) {
  screen.getByRole('button', { name: 'Pause' }).focus();
  await user.keyboard('{ArrowDown}');
}

describe('apps/client/web: useShortsNavigation', () => {
  it('puts a Short opened by link first when the feed has not served it, and the feed after it', async () => {
    const { router, user } = await renderShorts({ path: `/shorts/${LINKED}` });
    expect(screen.getByRole('region', { name: 'Shorts player' })).toHaveTextContent('Linked Short');

    await moveDown(user);

    await waitFor(() => expect(router.state.location.pathname).toBe(`/shorts/${SHORTS[0]?.id}`));
  });

  it('opens the first Short of the feed at /shorts, and names it in the URL only once it moves', async () => {
    const { router, user } = await renderShorts();

    expect(router.state.location.pathname).toBe('/shorts');

    await moveDown(user);

    await waitFor(() => expect(router.state.location.pathname).toBe(`/shorts/${SHORTS[1]?.id}`));
  });

  it('moves on from the Short the URL names, while the move before it has yet to render', async () => {
    const { router } = await renderShorts();
    const frame = screen.getByRole('region', { name: 'Shorts player' });

    fireEvent.keyDown(frame, { key: 'ArrowDown' });
    fireEvent.keyDown(frame, { key: 'ArrowDown' });

    await waitFor(() => expect(router.state.location.pathname).toBe(`/shorts/${SHORTS[2]?.id}`));
    expect(screen.getByRole('status')).toHaveTextContent('Short 3');
  });

  it('asks for the next page, with the cursor the last one returned, as the viewer nears the end', async () => {
    const cursors: Array<string | null> = [];
    const more = [shortSummary(5), shortSummary(6)];
    const { user } = await renderShorts({
      handlers: [
        mockEndpoint(getShorts, ({ request }) => {
          const cursor = new URL(request.url).searchParams.get('cursor');
          cursors.push(cursor);
          return HttpResponse.json(
            cursor
              ? { items: more, nextCursor: null, total: 6 }
              : { items: SHORTS, nextCursor: 'after-4', total: 6 }
          );
        }),
      ],
    });

    await moveDown(user);

    await waitFor(() => expect(cursors).toEqual([null, 'after-4']));
  });
});
