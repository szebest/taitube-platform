import { Video } from "src/modules/shared/models";

export type VideoDetails = {
	userFullName: string;
	userId: string;
	likes: number;
	dislikes: number;
	subscriptions: number;
	isSubscribed?: boolean;
	isLiked: boolean;
	isDisliked: boolean;
} & Video;