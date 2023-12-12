import { memo } from "react";
import { Button } from "react-bootstrap";

import styles from "./profile-picture.module.scss";

import { useDeleteSubscriptionMutation, usePostSubscriptionMutation } from "../../api";

export type SubscribeButtonProps = {
	isSubscribed: boolean;
	userId: string;
	userFullName: string;
	videoId?: number;
};

export const SubscribeButton = memo(({ isSubscribed, userId, userFullName, videoId }: SubscribeButtonProps) => {
	const [subscribe, { isLoading: isSubscribeLoading }] = usePostSubscriptionMutation();
	const [unsubscribe, { isLoading: isUnsubscribeLoading }] = useDeleteSubscriptionMutation();

	const handleSubscribe = () => {
		subscribe({
			userId,
			userFullName,
			videoId
		});
	}

	const handleUnsubscribe = () => {
		unsubscribe({
			userId,
			videoId
		});
	}

	return (
		<Button
			className={`${
				isSubscribed ? "btn-light" : "btn-dark"
			} btn-lg btn-pill`}
			onClick={isSubscribed ? handleUnsubscribe : handleSubscribe}
			disabled={isSubscribeLoading || isUnsubscribeLoading}
		>
			<span>{isSubscribed ? "Unsubscribe" : "Subscribe"}</span>
		</Button>
	);
});

export default SubscribeButton;
