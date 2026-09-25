import styles from './subscriptions-page.module.scss';

import { subscriptionsApi } from '#app/modules/shared/api';

import { LoadingSpinner } from '#app/modules/shared/components';
import { SubscriptionCard } from '#app/modules/Subscriptions/components';

export function SubscriptionsPage() {
	const { data, isLoading } = subscriptionsApi.useMySubscriptionsQuery();

	if (isLoading) return <LoadingSpinner />
	if (!data) return null;

	return (
		<div className={styles.container}>
			<h3>Your subsciptions:</h3>
			{data.items.map((channel) => (
				<SubscriptionCard key={channel.id} channel={channel} />
			))}
		</div>
	);
}
