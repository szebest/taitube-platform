import { Button, ButtonGroup } from "react-bootstrap";
import { toast } from "react-toastify";

import styles from "./video-likes.module.scss";

import type { Video } from "@vp/api-contracts";
import { Format } from "@vp/intl-react";

import { reactionsApi } from "src/modules/shared/api";
import { useAuth } from "src/modules/shared/providers";

export type VideoLikesProps = {
	video: Video;
};

type Reaction = 'LIKE' | 'DISLIKE';

const ICONS: Readonly<Record<Reaction, string>> = {
	LIKE: 'bi-hand-thumbs-up',
	DISLIKE: 'bi-hand-thumbs-down',
};

export const VideoLikes = ({ video }: VideoLikesProps) => {
	const { account } = useAuth();

	const { data: myReaction } = reactionsApi.useMyReactionQuery(video.id, { skip: account === undefined });
	const [setReaction, { isLoading }] = reactionsApi.useSetReactionMutation();

	const react = (type: Reaction | 'NONE') => {
		if (account === undefined) {
			toast("You must be logged in to like a video");
			return;
		}

		setReaction({ id: video.id, type });
	}

	const reactionButton = (type: Reaction, count: number) => {
		const given = myReaction?.reaction === type;
		return (
			<Button
				className={`${given ? "btn-dark" : "btn-light"} btn-lg btn-pill`}
				onClick={() => react(given ? 'NONE' : type)}
				disabled={isLoading}
			>
				<i className={`bi ${ICONS[type]}${given ? '-fill' : ''}`} />
				<Format value={{ type: 'count', value: count }} />
			</Button>
		);
	};

	return (
		<ButtonGroup className={styles.container}>
			{reactionButton('LIKE', video.likesCount)}

			<button type="button"
				role="separator"
				className="btn btn-secondary mr-0 ml-0 pr-0 pl-0"
				disabled
			/>

			{reactionButton('DISLIKE', video.dislikesCount)}
		</ButtonGroup>
	);
};
