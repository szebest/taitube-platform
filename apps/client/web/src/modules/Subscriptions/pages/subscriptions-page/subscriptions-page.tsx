import { useSuspenseQuery } from '@tanstack/react-query';
import { EmptyLibraryIllustration, EmptyState, PageHeader } from '@vp/components';
import { useT } from '@vp/intl-react';
import { useApi } from '@vp/queries';
import { mySubscriptionsQueryOptions } from '#app/features/subscriptions/api/subscription-queries';
import { SubscriptionCard } from '#app/modules/Subscriptions/components';
import styles from './subscriptions-page.module.scss';

export function SubscriptionsPage() {
  const api = useApi();
  const { data } = useSuspenseQuery(mySubscriptionsQueryOptions(api));
  const { tOr } = useT();

  return (
    <div className={styles.container}>
      <PageHeader.Root>
        <PageHeader.Title asChild>
          <h1>{tOr('channels.subscriptionsTitle', {}, '')}</h1>
        </PageHeader.Title>
      </PageHeader.Root>
      {data.items.length === 0 && (
        <EmptyState.Root size="section">
          <EmptyState.Illustration>
            <EmptyLibraryIllustration />
          </EmptyState.Illustration>
          <EmptyState.Title>{tOr('channels.subscriptionsEmpty', {}, '')}</EmptyState.Title>
        </EmptyState.Root>
      )}
      {data.items.map((channel) => (
        <SubscriptionCard key={channel.id} channel={channel} />
      ))}
    </div>
  );
}
