import type { QueryClient } from '@tanstack/react-query';
import { Menu } from 'react-pro-sidebar';
import { subscribedChannel } from '#app/__tests__/fixtures';
import { renderPage } from '#app/__tests__/render-page';
import { mySubscriptionsQueryOptions } from '#app/features/subscriptions/api/subscription-queries';
import { createQueryClient } from '#app/integrations/query/create-query-client';
import { SidebarSubscriptions } from '../sidebar-subscriptions';

function channels(count: number) {
  return Array.from({ length: count }, (_, index) =>
    subscribedChannel({
      id: `0190c3a0-5e1d-7000-8000-00000000c10${index}`,
      displayName: `Channel ${index + 1}`,
    })
  );
}

function subscribedTo(count: number): QueryClient {
  const queryClient = createQueryClient();
  queryClient.setQueryData(mySubscriptionsQueryOptions().queryKey, {
    items: channels(count),
    nextCursor: null,
  });
  return queryClient;
}

async function renderSubscriptions(queryClient: QueryClient): Promise<string> {
  return renderPage(
    <Menu>
      <SidebarSubscriptions close={() => {}} />
    </Menu>,
    { queryClient }
  );
}

describe('apps/client/web: sidebar subscriptions', () => {
  it('links to the subscriptions page before the list arrives', async () => {
    expect(await renderSubscriptions(createQueryClient())).toContain('href="/subscriptions"');
  });

  it('links every subscribed channel when there are few', async () => {
    const markup = await renderSubscriptions(subscribedTo(3));

    expect(markup).toContain('href="/channel/0190c3a0-5e1d-7000-8000-00000000c102"');
    expect(markup).toContain('Channel 3');
    expect(markup).not.toContain('Show more');
  });

  it('shows the first five channels and offers the rest behind show more', async () => {
    const markup = await renderSubscriptions(subscribedTo(7));

    expect(markup).toContain('Subscriptions: 7');
    expect(markup).toContain('Channel 5');
    expect(markup).not.toContain('Channel 6');
    expect(markup).toContain('Show more');
  });
});
