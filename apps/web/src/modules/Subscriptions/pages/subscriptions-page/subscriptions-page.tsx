import styles from './subscriptions-page.module.scss';

import { useGetUserSubscriptionsQuery } from 'src/modules/shared/api';

import { LoadingSpinner } from 'src/modules/shared/components';
import { SubscriptionCard } from '../../components';

export function SubscriptionsPage() {
	const { data, isLoading } = useGetUserSubscriptionsQuery({});

	if (isLoading) return <LoadingSpinner />
	if (!data) return null;

	return (
		<div className={styles.container}>
			<h3>Your subsciptions:</h3>
			{data.map((subscription) => (
				<SubscriptionCard
					key={subscription.userId}
					subscription={subscription}
				/>
			))}
		</div>
	);
}

export default SubscriptionsPage;
