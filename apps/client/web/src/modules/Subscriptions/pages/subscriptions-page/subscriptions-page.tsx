import { useSuspenseQuery } from '@tanstack/react-query';
import { useApi } from '@vp/queries';

import styles from './subscriptions-page.module.scss';

import { mySubscriptionsQueryOptions } from '#app/features/subscriptions/api/subscription-queries';

import { SubscriptionCard } from '#app/modules/Subscriptions/components';

export function SubscriptionsPage() {
  const api = useApi();
  const { data } = useSuspenseQuery(mySubscriptionsQueryOptions(api));

  return (
    <div className={styles.container}>
      <h3>Your subsciptions:</h3>
      {data.items.map((channel) => (
        <SubscriptionCard key={channel.id} channel={channel} />
      ))}
    </div>
  );
}
