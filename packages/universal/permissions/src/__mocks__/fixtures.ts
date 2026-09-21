import type {
  CategoryResource,
  ChannelResource,
  CommentResource,
  UploadResource,
  UserContext,
  VideoResource,
} from '../types';

export const guestUser: UserContext | null = null;
export const standardUser: UserContext = { id: 'usr-1', role: 'USER', email: 'user@test.local' };
export const creatorUser: UserContext = {
  id: 'creator-1',
  role: 'CREATOR',
  email: 'creator@test.local',
};
export const moderatorUser: UserContext = {
  id: 'mod-1',
  role: 'MODERATOR',
  email: 'mod@test.local',
};
export const adminUser: UserContext = { id: 'admin-1', role: 'ADMIN', email: 'admin@test.local' };

export const publicVideo: VideoResource = {
  id: 'vid-pub',
  ownerId: 'creator-1',
  visibility: 'public',
  status: 'READY',
};

export const unlistedVideo: VideoResource = {
  id: 'vid-unl',
  ownerId: 'creator-1',
  visibility: 'unlisted',
  status: 'READY',
};

export const privateVideo: VideoResource = {
  id: 'vid-priv',
  ownerId: 'creator-1',
  visibility: 'private',
  status: 'READY',
};

export const foreignVideo: VideoResource = {
  id: 'vid-foreign',
  ownerId: 'creator-2',
  visibility: 'private',
  status: 'READY',
};

export const sampleUpload: UploadResource = {
  id: 'up-1',
  ownerId: 'creator-1',
  videoId: 'vid-pub',
};

export const foreignUpload: UploadResource = {
  id: 'up-2',
  ownerId: 'creator-2',
  videoId: 'vid-foreign',
};

export const sampleComment: CommentResource = {
  id: 'comment-1',
  authorId: 'usr-1',
  videoId: 'vid-pub',
  videoOwnerId: 'creator-1',
};

export const sampleChannel: ChannelResource = {
  id: 'chan-1',
  userId: 'usr-1',
  ownerId: 'usr-1',
};

export const sampleCategory: CategoryResource = {
  id: 'cat-1',
  slug: 'technology',
};
