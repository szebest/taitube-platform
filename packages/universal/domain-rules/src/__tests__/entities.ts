import type { Category, Channel, Comment, Upload, Video } from '@vp/domain';
import type { UserContext } from '@vp/permissions';

export const OWNER: UserContext = { id: 'owner-1', role: 'CREATOR' };
export const STRANGER: UserContext = { id: 'stranger-1', role: 'USER' };
export const ADMIN: UserContext = { id: 'admin-1', role: 'ADMIN' };

export function aVideo(overrides: Partial<Video> = {}): Video {
  return {
    id: 'video-1',
    ownerId: OWNER.id,
    title: 'A clip',
    description: null,
    visibility: 'public',
    status: 'READY',
    sourceKey: 'video-1/source.mp4',
    sourceSizeBytes: 1_000,
    durationMs: 1_000,
    width: 1920,
    height: 1080,
    ladder: null,
    generation: 1,
    version: 1,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    readyAt: new Date('2026-01-01T00:00:00.000Z'),
    ...overrides,
  };
}

export function anUpload(overrides: Partial<Upload> = {}): Upload {
  return {
    id: 'upload-1',
    videoId: 'video-1',
    strategy: 'single',
    status: 'OPEN',
    partSizeBytes: null,
    partsExpected: null,
    declaredSizeBytes: 1_000,
    declaredContentType: 'video/mp4',
    sha256: null,
    multipartUploadId: null,
    expiresAt: new Date('2026-01-01T01:00:00.000Z'),
    completedAt: null,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    ...overrides,
  };
}

export function aChannel(overrides: Partial<Channel> = {}): Channel {
  return {
    id: 'channel-1',
    userId: OWNER.id,
    handle: 'owner',
    displayName: 'Owner',
    avatarUrl: null,
    bannerUrl: null,
    bio: null,
    subscriberCount: 0,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    ...overrides,
  };
}

export const AUTHOR: UserContext = { id: 'author-1', role: 'USER' };
export const MODERATOR: UserContext = { id: 'moderator-1', role: 'MODERATOR' };

export function aComment(overrides: Partial<Comment> = {}): Comment {
  return {
    id: 'comment-1',
    videoId: 'video-1',
    authorId: AUTHOR.id,
    parentId: null,
    content: 'A comment',
    isPinned: false,
    isEdited: false,
    likeCount: 0,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    ...overrides,
  };
}

export function aCategory(overrides: Partial<Category> = {}): Category {
  return {
    id: 'category-1',
    name: 'Music',
    slug: 'music',
    description: null,
    iconUrl: null,
    sortOrder: 0,
    isActive: true,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    ...overrides,
  };
}
