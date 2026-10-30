import { createQueryClient } from '@vp/queries';
import { api, CHANNEL_ID } from '@vp/web-testing';
import { renderPage } from '@vp/web-testing/server';

import { AppProviders, signedIn } from '#app/__tests__/providers';
import { subscriptionStatusQueryOptions } from '#app/features/subscriptions/api/subscription-queries';
import { SubscribeButton } from '../subscribe-button';

async function renderButton(
  Providers = AppProviders,
  queryClient = createQueryClient()
): Promise<string> {
  return renderPage(<SubscribeButton channelId={CHANNEL_ID} />, Providers, { queryClient });
}

describe('apps/client/web: subscribe button', () => {
  it('offers a guest to subscribe', async () => {
    const markup = await renderButton();

    expect(markup).toContain('>Subscribe<');
    expect(markup).not.toContain('disabled=""');
  });

  it('waits for the answer before a signed-in viewer can press it', async () => {
    const markup = await renderButton(signedIn());

    expect(markup).toContain('disabled=""');
  });

  it.each([
    { subscribed: true, label: '>Subscribed<' },
    { subscribed: false, label: '>Subscribe<' },
  ])(
    'labels the button $label when the API says subscribed=$subscribed',
    async ({ subscribed, label }) => {
      const queryClient = createQueryClient();
      queryClient.setQueryData(subscriptionStatusQueryOptions(api, CHANNEL_ID).queryKey, {
        channelId: CHANNEL_ID,
        subscribed,
      });

      const markup = await renderButton(signedIn(), queryClient);

      expect(markup).toContain(label);
      expect(markup).not.toContain('disabled=""');
    }
  );
});
