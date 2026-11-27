import { Paginator } from '@kit/pagination';
import { ok } from '@kit/result';
import { expectOk } from '@kit/testing/result';
import { InMemoryRepositories } from '@vp/adapters/in-memory';
import { InMemoryPostOpenSketch } from '@vp/adapters/in-memory';
import type { CommentCachePort } from '@vp/core/ports';
import type {
  ActingChannel,
  ChannelRole,
  PlaylistVisibility,
  PostPayload,
  VideoStatus,
  VideoVisibility,
} from '@vp/domain';
import { asCdnBase } from '@vp/env-schema';
import type { UserContext } from '@vp/permissions';
import { uuidv7 } from 'uuidv7';
import { PostEngagementService } from '../post-engagement-service';
import { PostManageService } from '../post-manage-service';
import { PostService } from '../post-service';

export const NOW = Date.parse('2026-03-10T12:00:00.000Z');
export const OWNER: UserContext = { id: '00000000-0000-7000-8000-000000001201', role: 'USER' };
export const EDITOR_ID = '00000000-0000-7000-8000-000000001202';
export const MODERATOR_ID = '00000000-0000-7000-8000-000000001203';
export const STRANGER: UserContext = { id: '00000000-0000-7000-8000-000000001204', role: 'USER' };
export const ABSENT = '00000000-0000-7000-8000-0000000012ff';

export const CDN = asCdnBase('https://cdn.test');

export function member(
  id: string,
  channelId: string,
  role: ChannelRole,
  ownerId = OWNER.id
): UserContext {
  return { id, role: 'USER', memberships: { [channelId]: { role, ownerId } } };
}

export async function postsFixture(now: () => number = () => NOW) {
  const repositories = new InMemoryRepositories();
  const channel = expectOk(
    await repositories.channels.create({ userId: OWNER.id, handle: 'owner', displayName: 'Owner' })
  );
  const acting: ActingChannel = { channelId: channel.id, ownerId: OWNER.id, role: 'owner' };
  const commentCache: CommentCachePort = {
    getHot: vi.fn(),
    invalidate: vi.fn(async () => ok(undefined)),
  };
  const viewDeps = {
    posts: repositories.channelPosts,
    channels: repositories.channels,
    images: repositories.channelImages,
    videos: repositories.videos,
    playlists: repositories.playlists,
    engagement: repositories.postEngagement,
    cdn: CDN,
    paginator: new Paginator(),
    now,
  };
  const service = new PostService({ ...viewDeps, commentCache });
  const manage = new PostManageService(viewDeps);
  const openSketch = new InMemoryPostOpenSketch();
  const engagementService = new PostEngagementService({
    posts: service,
    engagement: repositories.postEngagement,
    restrictions: repositories.channelUserRestrictions,
    openSketch,
    now,
  });

  const video = async (
    visibility: VideoVisibility = 'public',
    status: VideoStatus = 'READY'
  ): Promise<string> => {
    const id = uuidv7();
    expectOk(
      await repositories.videos.create({
        id,
        ownerId: OWNER.id,
        channelId: channel.id,
        title: 'A video',
        visibility,
        status,
        sourceKey: `raw/${id}/source.mp4`,
      })
    );
    return id;
  };

  const playlist = async (visibility: PlaylistVisibility = 'public'): Promise<string> => {
    const id = uuidv7();
    expectOk(
      await repositories.playlists.create({
        id,
        ownerId: OWNER.id,
        title: 'A playlist',
        description: '',
        visibility,
      })
    );
    return id;
  };

  const readyImage = async (channelId = channel.id): Promise<string> => {
    const id = uuidv7();
    expectOk(
      await repositories.channelImages.create({
        id,
        channelId,
        uploadedBy: OWNER.id,
        kind: 'post-image',
        contentType: 'image/png',
        sizeBytes: 1000,
      })
    );
    const crop = { x: 0, y: 0, width: 2000, height: 1000 };
    expectOk(
      await repositories.channelImages.queue(id, {
        width: 2000,
        height: 1000,
        crops: { kind: 'post-image', crop },
      })
    );
    expectOk(
      await repositories.channelImages.commit(id, `https://cdn.test/${id}-640.webp`, {
        w640: `https://cdn.test/${id}-640.webp`,
        w1280: `https://cdn.test/${id}-1280.webp`,
      })
    );
    return id;
  };

  const publish = async (payload: PostPayload = { kind: 'text', text: 'hello' }) =>
    expectOk(await service.create(OWNER, acting, { payload, commentsEnabled: true }));

  return {
    repositories,
    channel,
    acting,
    service,
    manage,
    engagementService,
    commentCache,
    video,
    playlist,
    readyImage,
    publish,
  };
}
