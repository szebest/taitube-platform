export type VideoComment = {
	id?: number;
	userId: number;
	videoId: number;
	data: string;
	fullName: string;
	createdAt: string;
	isEdited: boolean;
	profilePictureSrc: string | null;
}

export type AddVideoComment = Omit<VideoComment, 'userId' | 'videoId' | 'createdAt' | 'loading' | 'fullName' | 'profilePictureSrc'>;