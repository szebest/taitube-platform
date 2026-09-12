import { Video } from "src/modules/shared/models";

export type VideoDetails = {
	likes: number;
	dislikes: number;
	subscriptions: number;
	isLiked: boolean;
	isDisliked: boolean;
} & Omit<Video, 'thumbnailSrc'>;