export type VideoComment = {
	userId: number;
	videoId: number;
	data: string;
	fullName: string;
	createdAt: string;
	loading?: boolean;
}

export type AddVideoComment = Omit<VideoComment, 'userId' | 'videoId' | 'createdAt'>;