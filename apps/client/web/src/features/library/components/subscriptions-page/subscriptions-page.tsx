import { useSuspenseQuery } from '@tanstack/react-query';
import { EmptyLibraryIllustration, EmptyState, PageHeader } from '@vp/components';
import { useT } from '@vp/intl-react';
import { useApi } from '@vp/queries';
import { ChannelRow } from '#app/components/channel/channel-row';
import { mySubscriptionsQueryOptions } from '#app/lib/query-keys/subscription-keys';

export function SubscriptionsPage() {
  const api = useApi();
  const { data } = useSuspenseQuery(mySubscriptionsQueryOptions(api));
  const { tOr } = useT();

  return (
    <section className="flex flex-col gap-6">
      <PageHeader.Root>
        <PageHeader.Title asChild>
          <h1>{tOr('channels.subscriptionsTitle', {}, '')}</h1>
        </PageHeader.Title>
      </PageHeader.Root>
      {data.items.length === 0 ? (
        <EmptyState.Root size="section">
          <EmptyState.Illustration>
            <EmptyLibraryIllustration />
          </EmptyState.Illustration>
          <EmptyState.Title>{tOr('channels.subscriptionsEmpty', {}, '')}</EmptyState.Title>
        </EmptyState.Root>
      ) : (
        <ul className="m-0 flex list-none flex-col gap-6 p-0">
          {data.items.map((channel) => (
            <li key={channel.id}>
              <ChannelRow channel={channel} bio={channel.bio} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
