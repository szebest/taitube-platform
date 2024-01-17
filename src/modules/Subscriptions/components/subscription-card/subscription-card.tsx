import { Link } from "react-router-dom";

import styles from "./subscription-card.module.scss";

import { Subscription } from "src/modules/shared/models";
import { ProfilePicture, SubscribeButton } from "src/modules/shared/components";

export type SubscriptionCardProps = {
	subscription: Subscription
}

export function SubscriptionCard({ subscription }: SubscriptionCardProps) {
	const userProfileRoute = `/user/${subscription.userId}`;

	return (
		<div className={styles.container}>
			<Link to={userProfileRoute}>
				<ProfilePicture src={subscription.profilePictureSrc} />
			</Link>
			<div className={styles.container__wrapper}>
				<Link to={userProfileRoute} title={subscription.userFullName}>
					<p className={styles.text}>{subscription.userFullName}</p>
				</Link>

				<SubscribeButton {...subscription} />
			</div>
		</div>
	);
}

export default SubscriptionCard;
