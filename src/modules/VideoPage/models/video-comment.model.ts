export type VideoComment = {
	id?: number;
	userId: number;
	videoId: number;
	data: string;
	fullName: string;
	createdAt: string;
	profilePictureSrc: string;
}

export type AddVideoComment = Omit<VideoComment, 'userId' | 'videoId' | 'createdAt' | 'loading' | 'fullName' | 'profilePictureSrc'>;