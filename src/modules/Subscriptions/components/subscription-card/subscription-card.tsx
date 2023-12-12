import { Link } from "react-router-dom";

import styles from "./subscription-card.module.scss";

import { Subscription } from "src/modules/shared/models";
import { SubscribeButton } from "src/modules/shared/components";

export type SubscriptionCardProps = {
	subscription: Subscription
}

export function SubscriptionCard({ subscription }: SubscriptionCardProps) {

	return (
		<div className={styles.container}>
			<div className={styles.container__wrapper}>
				<Link to={`/profile/${subscription.userId}`}><p>{subscription.userFullName}</p></Link>

				<SubscribeButton {...subscription} />
			</div>
		</div>
	);
}

export default SubscriptionCard;
