import { Button, ButtonGroup } from "react-bootstrap";
import { toast } from "react-toastify";

import styles from "./video-likes.module.scss";

import type { Video } from "@vp/api-contracts";

import { formatNumbers } from "src/modules/shared/helpers";

import { useMyReactionQuery, useSetReactionMutation } from "src/modules/shared/api";
import { useAuth } from "src/modules/shared/providers";

export type VideoLikesProps = {
	video: Video;
};

export const VideoLikes = ({ video }: VideoLikesProps) => {
	const { account } = useAuth();

	const { data: myReaction } = useMyReactionQuery(video.id, { skip: account === undefined });
	const [setReaction, { isLoading }] = useSetReactionMutation();

	const liked = myReaction?.reaction === 'LIKE';
	const disliked = myReaction?.reaction === 'DISLIKE';

	const react = (type: 'LIKE' | 'DISLIKE' | 'NONE') => {
		if (account === undefined) {
			toast("You must be logged in to like a video");
			return;
		}

		setReaction({ id: video.id, type });
	}

	return (
		<ButtonGroup className={styles.container}>
			<Button
				className={`${liked ? "btn-dark" : "btn-light"} btn-lg btn-pill`}
				onClick={() => react(liked ? 'NONE' : 'LIKE')}
				disabled={isLoading}
			>
				<i className={`bi bi-hand-thumbs-up${liked ? '-fill' : ''}`}></i>
				{formatNumbers(video.likesCount, video.likesCount >= 10000 ? 0 : 1)}
			</Button>

			<button
				role="separator"
				className="btn btn-secondary mr-0 ml-0 pr-0 pl-0"
				disabled
			></button>

			<Button
				className={`${disliked ? "btn-dark" : "btn-light"} btn-lg btn-pill`}
				onClick={() => react(disliked ? 'NONE' : 'DISLIKE')}
				disabled={isLoading}
			>
				<i className={`bi bi-hand-thumbs-down${disliked ? '-fill' : ''}`}></i>
				{formatNumbers(video.dislikesCount, video.dislikesCount >= 10000 ? 0 : 1)}
			</Button>
		</ButtonGroup>
	);
};

export default VideoLikes;
