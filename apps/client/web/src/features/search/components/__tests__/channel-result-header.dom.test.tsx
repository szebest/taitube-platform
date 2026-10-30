import { screen } from '@testing-library/react';
import { isSubscribedToChannel } from '@vp/api-contracts';
import { CHANNEL_ID, mockEndpoint } from '@vp/web-testing';
import { HttpResponse } from 'msw/http';

import {
  channelHit,
  page,
  renderSearch,
  searchReply,
} from '#app/features/search/__tests__/search-fixtures';

const URL = '/search?q=react&type=channel';

describe('apps/client/web: ChannelResultHeader', () => {
  it('shows the identity row with the matched bio and a link to the channel', async () => {
    await renderSearch(URL, [searchReply(() => page([channelHit()]))]);

    expect(await screen.findByRole('heading', { name: 'React Conf' })).toBeInTheDocument();
    expect(screen.getByText(/@reactconf/)).toBeInTheDocument();
    expect(screen.getByText(/4\.2K subscribers/)).toBeInTheDocument();
    expect(screen.getByText('React', { selector: 'mark' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'View channel' })).toHaveAttribute(
      'href',
      `/channel/${CHANNEL_ID}`
    );
  });

  it('leaves the bio out when the channel has none', async () => {
    await renderSearch(URL, [searchReply(() => page([channelHit({ bio: '' })]))]);

    await screen.findByRole('heading', { name: 'React Conf' });

    expect(screen.queryByText(/Talks about/)).not.toBeInTheDocument();
  });

  it('sends a guest who presses Subscribe to sign in, then back to the search', async () => {
    const { user, router } = await renderSearch(URL, [searchReply(() => page([channelHit()]))]);

    await user.click(await screen.findByRole('button', { name: 'Subscribe' }));

    expect(router.state.location.pathname).toBe('/login');
    expect(router.state.location.search).toEqual({ redirect: URL });
  });

  it.each([
    { subscribed: true, name: 'Subscribed' },
    { subscribed: false, name: 'Subscribe' },
  ])(
    'reads $name for a signed-in viewer whose status is $subscribed',
    async ({ subscribed, name }) => {
      await renderSearch(
        URL,
        [
          searchReply(() => page([channelHit()])),
          mockEndpoint(isSubscribedToChannel, () =>
            HttpResponse.json({ channelId: CHANNEL_ID, subscribed })
          ),
        ],
        true
      );

      expect(await screen.findByRole('button', { name })).toBeInTheDocument();
    }
  );
});
