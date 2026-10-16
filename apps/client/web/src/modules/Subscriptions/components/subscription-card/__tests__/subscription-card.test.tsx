import { CHANNEL_ID, subscribedChannel } from '@vp/web-testing';

import { renderPage } from '@vp/web-testing/server';

import { AppProviders } from '#app/__tests__/providers';
import { SubscriptionCard } from '../subscription-card';

describe('apps/client/web: subscription card', () => {
  it('links the channel by name and avatar and offers the subscribe button', async () => {
    const markup = await renderPage(
      <SubscriptionCard
        channel={subscribedChannel({ avatarUrl: 'http://localhost:9000/avatars/c.png' })}
      />,
      AppProviders
    );

    const channelLinks = markup.split(`href="/channel/${CHANNEL_ID}"`).length - 1;

    expect(channelLinks).toBe(2);
    expect(markup).toContain('The Creator');
    expect(markup).toContain('src="http://localhost:9000/avatars/c.png"');
    expect(markup).toContain('>Subscribe<');
  });
});
