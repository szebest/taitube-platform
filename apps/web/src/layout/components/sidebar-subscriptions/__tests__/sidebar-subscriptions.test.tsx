import { Menu } from 'react-pro-sidebar';
import { type ApiStore, createApiStore, seed } from '../../../../__tests__/api-store';
import { subscribedChannel } from '../../../../__tests__/fixtures';
import { renderPage } from '../../../../__tests__/render-page';
import { subscriptionsApi } from '../../../../modules/shared/api/subscriptions-api';
import { SidebarSubscriptions } from '../sidebar-subscriptions';

function channels(count: number) {
  return Array.from({ length: count }, (_, index) =>
    subscribedChannel({
      id: `0190c3a0-5e1d-7000-8000-00000000c10${index}`,
      displayName: `Channel ${index + 1}`,
    })
  );
}

async function storeWith(count: number): Promise<ApiStore> {
  const store = createApiStore();
  await seed(
    store,
    (target) => target.dispatch(subscriptionsApi.endpoints.mySubscriptions.initiate()),
    { items: channels(count), nextCursor: null }
  );
  return store;
}

async function renderSubscriptions(store: ApiStore): Promise<string> {
  return renderPage(
    <Menu>
      <SidebarSubscriptions close={() => {}} />
    </Menu>,
    { store }
  );
}

describe('apps/web: sidebar subscriptions', () => {
  it('links to the subscriptions page before the list arrives', async () => {
    expect(await renderSubscriptions(createApiStore())).toContain('href="/subscriptions"');
  });

  it('links every subscribed channel when there are few', async () => {
    const markup = await renderSubscriptions(await storeWith(3));

    expect(markup).toContain('href="/channel/0190c3a0-5e1d-7000-8000-00000000c102"');
    expect(markup).toContain('Channel 3');
    expect(markup).not.toContain('Show more');
  });

  it('shows the first five channels and offers the rest behind show more', async () => {
    const markup = await renderSubscriptions(await storeWith(7));

    expect(markup).toContain('Subscriptions: 7');
    expect(markup).toContain('Channel 5');
    expect(markup).not.toContain('Channel 6');
    expect(markup).toContain('Show more');
  });
});
