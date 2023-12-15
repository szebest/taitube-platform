import { memo, useState } from "react";
import { Button } from "react-bootstrap";
import { toast } from 'react-toastify';

import styles from "./profile-picture.module.scss";

import { useDeleteSubscriptionMutation, usePostSubscriptionMutation } from "../../api";

import { useAuth } from "../../providers";

export type SubscribeButtonProps = {
	isSubscribed: boolean;
	userId: number;
	userFullName: string;
	videoId?: number;
};

export const SubscribeButton = memo(({ isSubscribed, userId, userFullName, videoId }: SubscribeButtonProps) => {
	const [showToast, setShowToast] = useState(false);

	const { user, isLoading: isLoadingUser } = useAuth();

	const [subscribe, { isLoading: isSubscribeLoading }] = usePostSubscriptionMutation();
	const [unsubscribe, { isLoading: isUnsubscribeLoading }] = useDeleteSubscriptionMutation();

	const isLoading = isLoadingUser || isSubscribeLoading || isUnsubscribeLoading;

	const handleSubscribe = () => {
		if (!checkLoggedInStatus()) return;

		subscribe({
			userId,
			userFullName,
			videoId
		});
	}

	const handleUnsubscribe = () => {
		if (!checkLoggedInStatus()) return;

		unsubscribe({
			userId,
			videoId
		});
	}

	const checkLoggedInStatus = () => {
		if (user === undefined) {
			toast("You must be logged in to subscribe to a channel")

			return false;
		}

		return true;
	}

	return (
		<Button
			className={`${isSubscribed ? "btn-light" : "btn-dark"} btn-lg btn-pill`}
			onClick={isSubscribed ? handleUnsubscribe : handleSubscribe}
			disabled={isLoading}
		>
			<span>{isSubscribed ? "Unsubscribe" : "Subscribe"}</span>
		</Button>
	);
});

export default SubscribeButton;
