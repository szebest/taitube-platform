import { channel } from '@vp/web-testing';

import { renderPage } from '@vp/web-testing/server';

import { AppProviders } from '#app/__tests__/providers';
import { UserDetails } from '../user-details';

describe('apps/client/web: user details', () => {
  it('shows the channel name and the subscribe button', async () => {
    const markup = await renderPage(<UserDetails channel={channel()} />, AppProviders);

    expect(markup).toContain('<h2 title="The Creator">The Creator</h2>');
    expect(markup).toContain('>Subscribe<');
  });

  it.each([
    { subscriberCount: 1250, shown: '1.3K' },
    { subscriberCount: 12_500, shown: '13K' },
  ])('rounds $subscriberCount subscribers to $shown', async ({ subscriberCount, shown }) => {
    const markup = await renderPage(
      <UserDetails channel={channel({ subscriberCount })} />,
      AppProviders
    );

    expect(markup).toContain(`${shown} subscribers`);
  });
});
