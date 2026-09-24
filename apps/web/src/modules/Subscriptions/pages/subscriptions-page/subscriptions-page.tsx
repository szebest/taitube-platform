import styles from './subscriptions-page.module.scss';

import { useMySubscriptionsQuery } from 'src/modules/shared/api';

import { LoadingSpinner } from 'src/modules/shared/components';
import { SubscriptionCard } from '../../components';

export function SubscriptionsPage() {
	const { data, isLoading } = useMySubscriptionsQuery();

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
