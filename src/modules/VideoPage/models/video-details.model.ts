import { Video } from "src/modules/shared/models";

export type VideoDetails = {
	userFullName: string;
	userId: number;
	likes: number;
	dislikes: number;
	subscriptions: number;
	isSubscribed: boolean;
	isLiked: boolean;
	isDisliked: boolean;
} & Video;