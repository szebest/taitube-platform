import { screen } from '@testing-library/react';
import {
  type ContractResult,
  getChannel,
  setReaction,
  subscribeToChannel,
} from '@vp/api-contracts';
import { ErrorCodes } from '@vp/errors';
import {
  account,
  CHANNEL_ID,
  channel,
  mockEndpoint,
  problemReply,
  VIDEO_ID,
} from '@vp/web-testing';
import { heldReply } from '@vp/web-testing/dom';
import { HttpResponse } from 'msw/http';

import { renderWatch } from '../../__tests__/render-watch';

vi.mock(import('#app/features/player'), async (importOriginal) => ({
  ...(await importOriginal()),
  TaitubePlayer: (await import('../../__tests__/stub-player')).StubPlayer,
}));

const withFiveSubscribers = mockEndpoint(getChannel, () =>
  HttpResponse.json(channel({ subscriberCount: 5 }))
);

const subscribed = () =>
  HttpResponse.json<ContractResult<typeof subscribeToChannel>>({
    channelId: CHANNEL_ID,
    subscribed: true,
    subscriberCount: 6,
  });

const reacted = () =>
  HttpResponse.json<ContractResult<typeof setReaction>>({
    videoId: VIDEO_ID,
    reaction: 'LIKE',
    likesCount: 25,
    dislikesCount: 0,
  });

describe('apps/client/web: watch engagement bar', () => {
  it('shows the channel, its subscriber count and the like count', async () => {
    await renderWatch({ handlers: [withFiveSubscribers] });

    expect(screen.getByText('The Creator', { selector: 'span' }).closest('a')).toHaveAttribute(
      'href',
      `/channel/${CHANNEL_ID}`
    );
    expect(screen.getByText('5 subscribers')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Like 24' })).toHaveAttribute(
      'aria-pressed',
      'false'
    );
  });

  it.each([
    { action: 'Subscribe', name: 'Subscribe' },
    { action: 'Like', name: 'Like 24' },
  ])('sends a guest who presses $action to sign in, back to this video', async ({ name }) => {
    const { router, user } = await renderWatch();

    await user.click(screen.getByRole('button', { name }));

    await vi.waitFor(() => expect(router.state.location.pathname).toBe('/login'));
    expect(router.state.location.search).toEqual({ redirect: `/watch/${VIDEO_ID}` });
  });

  it('subscribes at once and settles on the count the API answers', async () => {
    const held = heldReply(subscribed);
    const { user } = await renderWatch({
      viewer: account(),
      handlers: [withFiveSubscribers, mockEndpoint(subscribeToChannel, held.answer)],
    });

    await user.click(screen.getByRole('button', { name: 'Subscribe' }));

    expect(await screen.findByRole('button', { name: 'Subscribed' })).toHaveAttribute(
      'aria-pressed',
      'true'
    );
    expect(screen.getByText('6 subscribers')).toBeInTheDocument();
    held.release();
  });

  it('puts the subscription back and says so when the API refuses it', async () => {
    const { user } = await renderWatch({
      viewer: account(),
      handlers: [
        withFiveSubscribers,
        mockEndpoint(subscribeToChannel, () => problemReply(ErrorCodes.INTERNAL)),
      ],
    });

    await user.click(screen.getByRole('button', { name: 'Subscribe' }));

    expect(await screen.findByText('Your subscription could not be changed')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Subscribe' })).toHaveAttribute(
      'aria-pressed',
      'false'
    );
    expect(screen.getByText('5 subscribers')).toBeInTheDocument();
  });

  it('counts a like at once', async () => {
    const held = heldReply(reacted);
    const { user } = await renderWatch({
      viewer: account(),
      handlers: [mockEndpoint(setReaction, held.answer)],
    });

    await user.click(screen.getByRole('button', { name: 'Like 24' }));

    expect(await screen.findByRole('button', { name: 'Like 25' })).toHaveAttribute(
      'aria-pressed',
      'true'
    );
    held.release();
  });

  it('takes a like back and says so when the API refuses it', async () => {
    const { user } = await renderWatch({
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

  it('leaves out the channel of a video whose owner has none', async () => {
    await renderWatch({ video: { channel: null } });

    expect(screen.queryByRole('button', { name: 'Subscribe' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Like 24' })).toBeInTheDocument();
  });
});
