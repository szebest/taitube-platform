import { CHANNEL_ID, channel } from '@vp/web-testing';
import { renderPage } from '@vp/web-testing/server';

import { AppProviders } from '#app/__tests__/providers';
import { ChannelRow, type ChannelRowProps } from '../channel-row';

function renderRow(props: Partial<ChannelRowProps> = {}) {
  return renderPage(<ChannelRow channel={channel()} {...props} />, AppProviders);
}

describe('apps/client/web: channel row', () => {
  it('shows the channel as a heading with its handle and subscribers, and links to its page', async () => {
    const markup = await renderRow({ channel: channel({ subscriberCount: 4200 }) });

    expect(markup).toContain('>The Creator</h2>');
    expect(markup).toContain('4.2K subscribers');
    expect(markup).toContain(`href="/channel/${CHANNEL_ID}"`);
    expect(markup).toContain('View channel');
  });

  it('draws the bio it is given, and none otherwise', async () => {
    expect(await renderRow({ bio: 'Films about trams' })).toContain('Films about trams');
    expect(await renderRow()).not.toContain('channel-header-bio');
  });
});
