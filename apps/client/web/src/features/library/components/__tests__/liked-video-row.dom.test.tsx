import { screen, waitFor, within } from '@testing-library/react';
import { type ContractResult, setReaction } from '@vp/api-contracts';
import { ErrorCodes } from '@vp/errors';
import { mockEndpoint, problemReply } from '@vp/web-testing';
import { heldReply } from '@vp/web-testing/dom';
import { HttpResponse } from 'msw/http';

import { libraryVideo } from '../../__tests__/library-fixtures';
import { renderLibrary, useLibraryClock } from '../../__tests__/render-library';

const LIKED = [libraryVideo(1, 'Tram ride'), libraryVideo(2, 'Lisbon')];

const unlike = async (user: Awaited<ReturnType<typeof renderLibrary>>['user']) => {
  const card = (await screen.findByRole('link', { name: 'Tram ride' })).closest('article');
  if (!card) throw new Error('no card around Tram ride');
  await user.click(within(card).getByRole('button', { name: 'More actions' }));
  await user.click(await screen.findByRole('menuitem', { name: 'Unlike' }));
};

describe('apps/client/web: LikedVideoRow', () => {
  useLibraryClock();

  it('sends the reaction NONE and drops the video before the server answers', async () => {
    const held = heldReply(() =>
      HttpResponse.json<ContractResult<typeof setReaction>>({
        videoId: LIKED[0]?.id ?? '',
        reaction: null,
        likesCount: 0,
        dislikesCount: 0,
      })
    );
    const bodies: unknown[] = [];
    const { user } = await renderLibrary('/feed/history?tab=liked', {
      liked: LIKED,
      handlers: [
        mockEndpoint(setReaction, async (info) => {
          bodies.push(await info.request.clone().json());
          return held.answer();
        }),
      ],
    });

    await unlike(user);

    await waitFor(() => expect(screen.queryByRole('link', { name: 'Tram ride' })).toBeNull());
    expect(screen.getByRole('link', { name: 'Lisbon' })).toBeInTheDocument();
    held.release();
    await waitFor(() => expect(bodies).toEqual([{ type: 'NONE' }]));
  });

  it('puts the video back and says so when the server refuses', async () => {
    const { user } = await renderLibrary('/feed/history?tab=liked', {
      liked: LIKED,
      handlers: [mockEndpoint(setReaction, () => problemReply(ErrorCodes.INTERNAL))],
    });

    await unlike(user);

    expect(await screen.findByText('That change could not be saved')).toBeInTheDocument();
    expect(await screen.findByRole('link', { name: 'Tram ride' })).toBeInTheDocument();
  });
});
