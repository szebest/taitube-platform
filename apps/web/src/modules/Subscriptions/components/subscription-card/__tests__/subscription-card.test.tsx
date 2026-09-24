import { CHANNEL_ID, subscribedChannel } from '../../../../../__tests__/fixtures';
import { renderPage } from '../../../../../__tests__/render-page';
import { SubscriptionCard } from '../subscription-card';

describe('apps/web: subscription card', () => {
  it('links the channel by name and avatar and offers the subscribe button', () => {
    const markup = renderPage(
      <SubscriptionCard channel={subscribedChannel({ avatarUrl: 'http://localhost:9000/avatars/c.png' })} />
    );

    const channelLinks = markup.split(`href="/channel/${CHANNEL_ID}"`).length - 1;

    expect(channelLinks).toBe(2);
    expect(markup).toContain('The Creator');
    expect(markup).toContain('src="http://localhost:9000/avatars/c.png"');
    expect(markup).toContain('>Subscribe<');
  });
});
