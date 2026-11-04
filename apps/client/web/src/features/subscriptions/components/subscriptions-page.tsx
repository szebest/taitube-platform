import { useSuspenseQuery } from '@tanstack/react-query';
import { EmptyLibraryIllustration, EmptyState, PageHeader } from '@vp/components';
import { useT } from '@vp/intl-react';
import { useApi } from '@vp/queries';

import { ChannelRow } from '#app/features/channels/components/channel-row';
import { mySubscriptionsQueryOptions } from '../api/subscription-queries';

export function SubscriptionsPage() {
  const api = useApi();
  const { data } = useSuspenseQuery(mySubscriptionsQueryOptions(api));
  const { tOr } = useT();

  return (
    <section className="tw:flex tw:flex-col tw:gap-6">
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
        <ul className="tw:m-0 tw:flex tw:list-none tw:flex-col tw:gap-6 tw:p-0">
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
