import { Button, ButtonGroup } from "react-bootstrap";

import styles from "./video-likes.module.scss";

import { formatNumbers } from "src/modules/shared/helpers";

import { useDeleteLikeFromVideoMutation, useLikeVideoMutation } from "../../api/videoApiSlice";

import { VideoDetails } from "../../models";

export type VideoLikesProps = {
	data: VideoDetails;
	videoId: number;
};

export const VideoLikes = ({ data, videoId }: VideoLikesProps) => {
	const [likeVideo, { isLoading: isLikeVideoLoading }] = useLikeVideoMutation();
	const [deleteLikeFromVideo, { isLoading: isDeleteLikeLoading }] = useDeleteLikeFromVideoMutation();

	const handleLike = () => {
		likeVideo({ videoId, value: 1 });
	}

	const handleDislike = () => {
		likeVideo({ videoId, value: -1 });
	}

	const handleRemoveLikeOrDislike = () => {
		deleteLikeFromVideo({ videoId, isLike: data.isLiked });
	}

	return (
		<ButtonGroup className={styles.container}>
			<Button
				className={`${data.isLiked ? "btn-dark" : "btn-light"} btn-lg btn-pill`}
				onClick={data.isLiked ? handleRemoveLikeOrDislike : handleLike}
				disabled={isLikeVideoLoading || isDeleteLikeLoading}
			>
				<i className={`bi bi-hand-thumbs-up${data.isLiked ? '-fill' : ''}`}></i>
				{formatNumbers(data.likes, data.likes >= 10000 ? 0 : 1)}
			</Button>

			<button
				role="separator"
				className="btn btn-secondary mr-0 ml-0 pr-0 pl-0"
				disabled
			></button>

			<Button
				className={`${data.isDisliked ? "btn-dark" : "btn-light"} btn-lg btn-pill`}
				onClick={data.isDisliked ? handleRemoveLikeOrDislike : handleDislike}
				disabled={isLikeVideoLoading || isDeleteLikeLoading}
			>
				<i className={`bi bi-hand-thumbs-down${data.isDisliked ? '-fill' : ''}`}></i>
				{formatNumbers(data.dislikes, data.dislikes >= 10000 ? 0 : 1)}
			</Button>
		</ButtonGroup>
	);
};

export default VideoLikes;
