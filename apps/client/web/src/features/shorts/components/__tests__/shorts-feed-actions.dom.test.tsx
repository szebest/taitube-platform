import { screen, within } from '@testing-library/react';
import { type ContractResult, getMyReaction, setReaction } from '@vp/api-contracts';
import { ErrorCodes } from '@vp/errors';
import { account, mockEndpoint, problemReply } from '@vp/web-testing';
import { heldReply } from '@vp/web-testing/dom';
import { HttpResponse } from 'msw/http';

import { renderShorts } from '#app/features/shorts/__tests__/render-shorts';
import { SHORTS } from '#app/features/shorts/__tests__/short-fixtures';

vi.mock(import('#app/features/player'), async (importOriginal) => ({
  ...(await importOriginal()),
  TaitubePlayer: (await import('#app/features/shorts/__tests__/stub-short-player')).StubShortPlayer,
}));

const FIRST = SHORTS[0]?.id ?? '';

function likeAnswered() {
  let reaction: 'LIKE' | null = null;
  const held = heldReply(() => {
    reaction = 'LIKE';
    return HttpResponse.json<ContractResult<typeof setReaction>>({
      videoId: FIRST,
      reaction,
      likesCount: 25,
      dislikesCount: 0,
    });
  });
  return {
    held,
    handlers: [
      mockEndpoint(setReaction, held.answer),
      mockEndpoint(getMyReaction, () => HttpResponse.json({ videoId: FIRST, reaction })),
    ],
  };
}

describe('apps/client/web: the Shorts actions', () => {
  it('sends a guest who presses Like to sign in, back to this Short', async () => {
    const { router, user } = await renderShorts({ path: `/shorts/${FIRST}` });

    await user.click(screen.getByRole('button', { name: 'Like 24' }));

    await vi.waitFor(() => expect(router.state.location.pathname).toBe('/login'));
    expect(router.state.location.search).toEqual({ redirect: `/shorts/${FIRST}` });
  });

  it('likes at once and settles on the count the API answers', async () => {
    const { held, handlers } = likeAnswered();
    const { user } = await renderShorts({ viewer: account(), handlers });

    await user.click(screen.getByRole('button', { name: 'Like 24' }));
    held.release();

    expect(await screen.findByRole('button', { name: 'Like 25' })).toHaveAttribute(
      'aria-pressed',
      'true'
    );
  });

  it('takes the like back and says so when the API refuses it', async () => {
    const { user } = await renderShorts({
      viewer: account(),
      handlers: [mockEndpoint(setReaction, () => problemReply(ErrorCodes.INTERNAL))],
    });

    await user.click(screen.getByRole('button', { name: 'Like 24' }));

    expect(await screen.findByText('Your reaction could not be saved')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Like 24' })).toHaveAttribute(
      'aria-pressed',
      'false'
    );
  });

  it('shares the link to the Short in a dialog', async () => {
    const { user } = await renderShorts();

    await user.click(screen.getByRole('button', { name: 'Share' }));

    const dialog = await screen.findByRole('dialog', { name: 'Share this video' });
    expect(within(dialog).getByRole('textbox', { name: 'Link' })).toHaveValue(
      `http://localhost:3000/watch/${FIRST}`
    );
  });

  it('keeps the arrow keys inside the share dialog from moving the player', async () => {
    const { router, user } = await renderShorts();
    await user.click(screen.getByRole('button', { name: 'Share' }));
    const dialog = await screen.findByRole('dialog', { name: 'Share this video' });
    within(dialog).getByRole('button', { name: 'Copy' }).focus();

    await user.keyboard('{ArrowDown}');

    expect(router.state.location.pathname).toBe('/shorts');
  });

  it.each([
    { viewer: 'a guest', as: undefined, offered: false },
    { viewer: 'a member', as: account(), offered: true },
  ])('offers $viewer Save: $offered', async ({ as, offered }) => {
    await renderShorts({ viewer: as });

    expect(screen.queryByRole('button', { name: 'Save' }) !== null).toBe(offered);
  });
});
