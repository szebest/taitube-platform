import { type ApiStore, createApiStore, seed } from '../../../../../__tests__/api-store';
import { CHANNEL_ID, account, channel } from '../../../../../__tests__/fixtures';
import { renderPage, signIn } from '../../../../../__tests__/render-page';
import { accountApi } from '../../../../shared/api/account-api';
import { UserPage } from '../user-page';

async function storeWithChannel(): Promise<ApiStore> {
  const store = createApiStore();
  await seed(
    store,
    (target) => target.dispatch(accountApi.endpoints.channel.initiate(CHANNEL_ID)),
    channel()
  );
  return store;
}

async function renderChannel(store: ApiStore): Promise<string> {
  return renderPage(<UserPage />, {
    store,
    url: `/channel/${CHANNEL_ID}`,
    route: '/channel/$channelId',
  });
}

describe('apps/web: user page', () => {
  it('shows the spinner while the channel loads', async () => {
    expect(await renderChannel(createApiStore())).toContain('aria-label="Loading"');
  });

  it("shows someone else's channel without their video list", async () => {
    const markup = await renderChannel(await storeWithChannel());

    expect(markup).toContain('The Creator');
    expect(markup).not.toContain('Your videos:');
  });

  it("adds the video list on the viewer's own channel", async () => {
    const store = await storeWithChannel();
    await signIn(store, account());

    expect(await renderChannel(store)).toContain('Your videos:');
  });
});
