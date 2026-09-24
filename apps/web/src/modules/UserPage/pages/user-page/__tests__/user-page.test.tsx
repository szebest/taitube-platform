import { type ApiStore, createApiStore, seed } from '../../../../../__tests__/api-store';
import { CHANNEL_ID, account, channel } from '../../../../../__tests__/fixtures';
import { renderPage, signIn } from '../../../../../__tests__/render-page';
import { clearStoredValues } from '../../../../../__tests__/stored-value';
import { accountApi } from '../../../../shared/api/account-api';
import { UserPage } from '../user-page';

vi.mock(import('@uidotdev/usehooks'), async (importOriginal) => ({
  ...(await importOriginal()),
  useLocalStorage: (await import('../../../../../__tests__/stored-value')).useStoredValue,
}));

async function storeWithChannel(): Promise<ApiStore> {
  const store = createApiStore();
  await seed(
    store,
    (target) => target.dispatch(accountApi.endpoints.channel.initiate(CHANNEL_ID)),
    channel()
  );
  return store;
}

function renderChannel(store: ApiStore): string {
  return renderPage(<UserPage />, { store, url: `/channel/${CHANNEL_ID}`, route: '/channel/:channelId' });
}

describe('apps/web: user page', () => {
  beforeEach(() => {
    clearStoredValues();
  });

  it('renders nothing without a channel in the address', () => {
    expect(renderPage(<UserPage />, { url: '/channel' })).toBe('');
  });

  it('shows the spinner while the channel loads', () => {
    expect(renderChannel(createApiStore())).toContain('aria-label="Loading"');
  });

  it("shows someone else's channel without their video list", async () => {
    const markup = renderChannel(await storeWithChannel());

    expect(markup).toContain('The Creator');
    expect(markup).not.toContain('Your videos:');
  });

  it("adds the video list on the viewer's own channel", async () => {
    const store = await storeWithChannel();
    await signIn(store, account());

    expect(renderChannel(store)).toContain('Your videos:');
  });
});
