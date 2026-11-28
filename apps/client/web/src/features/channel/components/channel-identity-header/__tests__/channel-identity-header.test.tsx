import { channel } from '@vp/web-testing';
import { renderPage } from '@vp/web-testing/server';
import { AppProviders, withToasts } from '#app/__tests__/providers';
import { ChannelHeader } from '#app/components/channel/channel-header';
import { ChannelIdentityHeader } from '../channel-identity-header';

describe('apps/client/web: ChannelIdentityHeader', () => {
  it('shows the channel identity with Subscribe, then the tab strip it is given', async () => {
    const markup = await renderPage(
      <ChannelIdentityHeader channel={channel({ bio: 'Films about trams' })}>
        <ChannelHeader.Tabs>
          <ChannelHeader.Tab active>Home</ChannelHeader.Tab>
        </ChannelHeader.Tabs>
      </ChannelIdentityHeader>,
      withToasts(AppProviders)
    );

    expect(markup).toContain('>The Creator</h1>');
    expect(markup).toContain('Films about trams');
    expect(markup).toContain('Subscribe');
    expect(markup.indexOf('Subscribe')).toBeLessThan(markup.indexOf('>Home<'));
  });
});
