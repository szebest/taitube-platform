import { useQuery } from "@tanstack/react-query";
import { memo } from "react";
import { Button } from "react-bootstrap";
import { toast } from 'react-toastify';
import { type AnimationSequence, useAnimate } from "motion/react";

import styles from "./subscribe-button.module.scss";

import { subscriptionStatusQueryOptions } from "#app/features/subscriptions/api/subscription-queries";
import { useSetSubscription } from "#app/features/subscriptions/hooks/use-set-subscription";

import { useAuth } from "#app/modules/shared/providers";

const randomNumberBetween = (min: number, max: number) => {
	return Math.floor(Math.random() * (max - min + 1) + min);
};

export type SubscribeButtonProps = {
	channelId: string;
};

export const SubscribeButton = memo(({ channelId }: SubscribeButtonProps) => {
	const [scope, animate] = useAnimate();

	const { account, isLoading: isLoadingUser } = useAuth();

	const status = useQuery({ ...subscriptionStatusQueryOptions(channelId), enabled: account !== undefined });
	const setSubscription = useSetSubscription(channelId);

	const isSubscribed = status.data?.subscribed ?? false;
	const isLoading = isLoadingUser || status.isLoading || setSubscription.isPending;

	const handleSubscribe = () => {
		if (!checkLoggedInStatus()) return;

		const sparkles = Array.from({ length: 20 });
		const sparklesAnimation: AnimationSequence = sparkles.map((_, index) => [
			`.sparkle-${index}`,
			{
				x: randomNumberBetween(-80, 80),
				y: randomNumberBetween(-80, 80),
				scale: randomNumberBetween(1.5, 2.5),
				opacity: 1,
			},
			{
				duration: 0.4,
				at: "<",
			},
		]);

		const sparklesFadeOut: AnimationSequence = sparkles.map((_, index) => [
			`.sparkle-${index}`,
			{
				opacity: 0,
				scale: 0,
			},
			{
				duration: 0.3,
				at: "<",
			},
		]);

		const sparklesReset: AnimationSequence = sparkles.map((_, index) => [
			`.sparkle-${index}`,
			{
				x: 0,
				y: 0,
			},
			{
				duration: 0.000001,
			},
		]);

		animate([
			...sparklesReset,
			["button", { scale: 0.75 }, { duration: 0.1, at: "<" }],
			["button", { scale: 1 }, { duration: 0.1 }],
			...sparklesAnimation,
			["button", { scale: 1 }, { duration: 0.000001 }],
			...sparklesFadeOut
		]);

		setSubscription.mutate(true);
	}

	const handleUnsubscribe = () => {
		if (!checkLoggedInStatus()) return;

		setSubscription.mutate(false);
	}

	const checkLoggedInStatus = () => {
		if (account === undefined) {
			toast("You must be logged in to subscribe to a channel")

			return false;
		}

		return true;
	}

	return (
		<div ref={scope}>
			<Button
				className={`${isSubscribed ? "btn-light" : "btn-dark"} btn-lg btn-pill ${styles.subscribeBtn
					}`}
				onClick={isSubscribed ? handleUnsubscribe : handleSubscribe}
				disabled={isLoading}
			>
				<span className="sr-only">{isSubscribed ? "Subscribed" : "Subscribe"}</span>

				{/* Used for animation */}
				<span
					aria-hidden
					className={styles.stars}
				>
					{Array.from({ length: 20 }, (_, index) => `sparkle-${index}`).map((sparkle) => (
						<svg
							className={`${styles.stars__star} ${sparkle}`}
							key={sparkle}
							aria-hidden="true"
							viewBox="0 0 122 117"
							width="10"
							height="10"
						>
							<path
								d="M64.39,2,80.11,38.76,120,42.33a3.2,3.2,0,0,1,1.83,5.59h0L91.64,74.25l8.92,39a3.2,3.2,0,0,1-4.87,3.4L61.44,96.19,27.09,116.73a3.2,3.2,0,0,1-4.76-3.46h0l8.92-39L1.09,47.92A3.2,3.2,0,0,1,3,42.32l39.74-3.56L58.49,2a3.2,3.2,0,0,1,5.9,0Z"
							/>
						</svg>
					))}
				</span>
			</Button>
		</div>
	);
});
