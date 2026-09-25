import { type ApiStore, createApiStore, seed } from '#app/__tests__/api-store';
import { CHANNEL_ID, account } from '#app/__tests__/fixtures';
import { renderPage, signIn } from '#app/__tests__/render-page';
import { subscriptionsApi } from '#app/modules/shared/api/subscriptions-api';
import { SubscribeButton } from '../subscribe-button';

async function renderButton(store: ApiStore): Promise<string> {
  return renderPage(<SubscribeButton channelId={CHANNEL_ID} />, { store });
}

async function signedInStore(): Promise<ApiStore> {
  const store = createApiStore();
  await signIn(store, account());
  return store;
}

describe('apps/web: subscribe button', () => {
  it('offers a guest to subscribe', async () => {
    const markup = await renderButton(createApiStore());

    expect(markup).toContain('>Subscribe<');
    expect(markup).not.toContain('disabled=""');
  });

  it('waits for the answer before a signed-in viewer can press it', async () => {
    const markup = await renderButton(await signedInStore());

    expect(markup).toContain('disabled=""');
  });

  it.each([
    { subscribed: true, label: '>Subscribed<' },
    { subscribed: false, label: '>Subscribe<' },
  ])(
    'labels the button $label when the API says subscribed=$subscribed',
    async ({ subscribed, label }) => {
      const store = await signedInStore();
      await seed(
        store,
        (target) => target.dispatch(subscriptionsApi.endpoints.isSubscribed.initiate(CHANNEL_ID)),
        { channelId: CHANNEL_ID, subscribed }
      );

      const markup = await renderButton(store);

      expect(markup).toContain(label);
      expect(markup).not.toContain('disabled=""');
    }
  );
});
