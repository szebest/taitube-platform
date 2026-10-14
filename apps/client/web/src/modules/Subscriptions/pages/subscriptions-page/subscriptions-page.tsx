import { useSuspenseQuery } from '@tanstack/react-query';

import styles from './subscriptions-page.module.scss';

import { mySubscriptionsQueryOptions } from '#app/features/subscriptions/api/subscription-queries';

import { SubscriptionCard } from '#app/modules/Subscriptions/components';

export function SubscriptionsPage() {
	const { data } = useSuspenseQuery(mySubscriptionsQueryOptions());

	return (
		<div className={styles.container}>
			<h3>Your subsciptions:</h3>
			{data.items.map((channel) => (
				<SubscriptionCard key={channel.id} channel={channel} />
			))}
		</div>
	);
}
