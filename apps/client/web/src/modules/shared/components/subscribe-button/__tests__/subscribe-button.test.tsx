import type { QueryClient } from '@tanstack/react-query';
import { createQueryClient } from '@vp/queries';
import { CHANNEL_ID } from '@vp/web-testing';
import { api } from '#app/__tests__/api';
import { renderPage, signIn } from '#app/__tests__/render-page';
import { subscriptionStatusQueryOptions } from '#app/features/subscriptions/api/subscription-queries';
import { SubscribeButton } from '../subscribe-button';

async function renderButton(queryClient: QueryClient): Promise<string> {
  return renderPage(<SubscribeButton channelId={CHANNEL_ID} />, { queryClient });
}

describe('apps/client/web: subscribe button', () => {
  it('offers a guest to subscribe', async () => {
    const markup = await renderButton(createQueryClient());

    expect(markup).toContain('>Subscribe<');
    expect(markup).not.toContain('disabled=""');
  });

  it('waits for the answer before a signed-in viewer can press it', async () => {
    const markup = await renderButton(signIn());

    expect(markup).toContain('disabled=""');
  });

  it.each([
    { subscribed: true, label: '>Subscribed<' },
    { subscribed: false, label: '>Subscribe<' },
  ])(
    'labels the button $label when the API says subscribed=$subscribed',
    async ({ subscribed, label }) => {
      const queryClient = signIn();
      queryClient.setQueryData(subscriptionStatusQueryOptions(api, CHANNEL_ID).queryKey, {
        channelId: CHANNEL_ID,
        subscribed,
      });

      const markup = await renderButton(queryClient);

      expect(markup).toContain(label);
      expect(markup).not.toContain('disabled=""');
    }
  );
});
