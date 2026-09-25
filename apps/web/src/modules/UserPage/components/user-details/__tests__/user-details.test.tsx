import { channel } from '../../../../../__tests__/fixtures';
import { renderPage } from '../../../../../__tests__/render-page';
import { UserDetails } from '../user-details';

describe('apps/web: user details', () => {
  it('shows the channel name and the subscribe button', () => {
    const markup = renderPage(<UserDetails channel={channel()} />);

    expect(markup).toContain('<h2 title="The Creator">The Creator</h2>');
    expect(markup).toContain('>Subscribe<');
  });

  it.each([
    { subscriberCount: 1250, shown: '1.3K' },
    { subscriberCount: 12_500, shown: '13K' },
  ])('rounds $subscriberCount subscribers to $shown', ({ subscriberCount, shown }) => {
    const markup = renderPage(<UserDetails channel={channel({ subscriberCount })} />);

    expect(markup).toContain(`${shown} subscribers`);
  });
});
