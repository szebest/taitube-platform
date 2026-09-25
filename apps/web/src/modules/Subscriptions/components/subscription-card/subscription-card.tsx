import { Link } from "@tanstack/react-router";

import styles from "./subscription-card.module.scss";

import type { SubscribedChannel } from "@vp/api-contracts";

import { ProfilePicture, SubscribeButton } from "src/modules/shared/components";

export type SubscriptionCardProps = {
	channel: SubscribedChannel;
}

export function SubscriptionCard({ channel }: SubscriptionCardProps) {
	return (
		<div className={styles.container}>
			<Link to="/channel/$channelId" params={{ channelId: channel.id }}>
				<ProfilePicture src={channel.avatarUrl} />
			</Link>
			<div className={styles.container__wrapper}>
				<Link to="/channel/$channelId" params={{ channelId: channel.id }} title={channel.displayName}>
					<p className={styles.text}>{channel.displayName}</p>
				</Link>

				<SubscribeButton channelId={channel.id} />
			</div>
		</div>
	);
}
