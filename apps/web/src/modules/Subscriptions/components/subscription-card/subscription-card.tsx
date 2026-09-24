import { Link } from "react-router-dom";

import styles from "./subscription-card.module.scss";

import type { SubscribedChannel } from "@vp/api-contracts";

import { ProfilePicture, SubscribeButton } from "src/modules/shared/components";

export type SubscriptionCardProps = {
	channel: SubscribedChannel;
}

export function SubscriptionCard({ channel }: SubscriptionCardProps) {
	const channelRoute = `/channel/${channel.id}`;

	return (
		<div className={styles.container}>
			<Link to={channelRoute}>
				<ProfilePicture src={channel.avatarUrl} />
			</Link>
			<div className={styles.container__wrapper}>
				<Link to={channelRoute} title={channel.displayName}>
					<p className={styles.text}>{channel.displayName}</p>
				</Link>

				<SubscribeButton channelId={channel.id} />
			</div>
		</div>
	);
}
