import { screen } from '@testing-library/react';
import {
  type ContractResult,
  getChannel,
  setReaction,
  subscribeToChannel,
} from '@vp/api-contracts';
import { ErrorCodes } from '@vp/errors';
import { writeCookie } from '@vp/ui';
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
import { renderWatch } from '#app/__tests__/render-watch';

vi.mock(import('#app/components/player/taitube-player/taitube-player'), async () => ({
  TaitubePlayer: (await import('#app/__tests__/stub-player')).StubPlayer,
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

const brandedAs = (brandColor: string | null) =>
  mockEndpoint(getChannel, () => HttpResponse.json(channel({ brandColor })));

const brandScope = () => document.querySelector('[data-brand]');

describe('apps/client/web: watch engagement bar', () => {
  afterEach(() => {
    writeCookie('vp.appearance', '', { maxAge: 0 });
  });

  it('keeps a channel that cannot load to its own section, leaving the actions', async () => {
    const offline = mockEndpoint(getChannel, () => HttpResponse.error());
    await renderWatch({ handlers: [offline] });

    const alert = await screen.findByRole('alert');

    expect(alert).toHaveTextContent('The channel could not be loaded');
    expect(screen.getByRole('button', { name: 'Share' })).toBeInTheDocument();
  });

  it("scopes the channel's derived accent to its row: the channel and Subscribe", async () => {
    await renderWatch({ handlers: [brandedAs('#3366cc')] });

    const scope = brandScope();
    expect(scope).toHaveAttribute('data-brand', '3366cc');
    expect(scope).toContainElement(screen.getByRole('button', { name: 'Subscribe' }));
    expect(scope).toContainElement(screen.getByText('The Creator', { selector: 'span' }));
    expect(scope).not.toContainElement(screen.getByRole('button', { name: 'Like 24' }));
    expect(document.head.innerHTML + document.body.innerHTML).toContain('[data-brand="3366cc"] {');
  });

  it.each([
    { name: 'a channel with no brand colour', brandColor: null, cookie: undefined },
    {
      name: "a viewer's own accent",
      brandColor: '#3366cc',
      cookie: JSON.stringify({ schema: 2, accent: '#aa2200' }),
    },
  ])('leaves the row on the theme accent for $name', async ({ brandColor, cookie }) => {
    if (cookie !== undefined) writeCookie('vp.appearance', cookie, { maxAge: 60 });

    await renderWatch({ handlers: [brandedAs(brandColor)] });

    expect(brandScope()).toBeNull();
  });

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
