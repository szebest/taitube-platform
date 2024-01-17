import { memo } from "react";
import { Button } from "react-bootstrap";
import { toast } from 'react-toastify';
import { animate, stagger, useAnimate } from "framer-motion";

import styles from "./subscribe-button.module.scss";

import { useDeleteSubscriptionMutation, usePostSubscriptionMutation } from "../../api";

import { useAuth } from "../../providers";
import { useIsSubscribed } from "../../hooks";

const randomNumberBetween = (min: number, max: number) => {
  return Math.floor(Math.random() * (max - min + 1) + min);
};

type AnimationSequence = Parameters<typeof animate>[0];

export type SubscribeButtonProps = {
	userId: number;
	userFullName: string;
	videoId?: number;
};

export const SubscribeButton = memo(({ userId, userFullName, videoId }: SubscribeButtonProps) => {
	const [scope, animate] = useAnimate();
	
	const { user, isLoading: isLoadingUser } = useAuth();

	const { isSubscribed, isLoading: isIssubscribedLoading } = useIsSubscribed(userId, user !== undefined);

	const [subscribe, { isLoading: isSubscribeLoading }] = usePostSubscriptionMutation();
	const [unsubscribe, { isLoading: isUnsubscribeLoading }] = useDeleteSubscriptionMutation();

	const isLoading = isLoadingUser || isSubscribeLoading || isUnsubscribeLoading || isIssubscribedLoading;

	const handleSubscribe = () => {
		if (!checkLoggedInStatus()) return;

		subscribe({
			userId,
			userFullName,
			videoId
		});

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
			["button", { scale: 1 }, { duration: 0.0000000001 }],
      ...sparklesFadeOut,
    ]);
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
		<div ref={scope}>
			<Button
				className={`${isSubscribed ? "btn-light" : "btn-dark"} btn-lg btn-pill ${
					styles.subscribeBtn
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
					{Array.from({ length: 20 }).map((_, index) => (
						<svg
							className={`${styles.stars__star} sparkle-${index}`}
							key={index}
							viewBox="0 0 122 117"
							width="10"
							height="10"
						>
							<path
								className="fill-blue-600"
								d="M64.39,2,80.11,38.76,120,42.33a3.2,3.2,0,0,1,1.83,5.59h0L91.64,74.25l8.92,39a3.2,3.2,0,0,1-4.87,3.4L61.44,96.19,27.09,116.73a3.2,3.2,0,0,1-4.76-3.46h0l8.92-39L1.09,47.92A3.2,3.2,0,0,1,3,42.32l39.74-3.56L58.49,2a3.2,3.2,0,0,1,5.9,0Z"
							/>
						</svg>
					))}
				</span>
			</Button>
		</div>
	);
});

export default SubscribeButton;
