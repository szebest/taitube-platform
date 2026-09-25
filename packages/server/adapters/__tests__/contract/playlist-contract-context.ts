import type { PlaylistRepositoryPort } from '@vp/core/repositories';
import type { PlaylistVisibility } from '@vp/domain';
import type { UserContext } from '@vp/permissions';
import { expectOk } from '@vp/testing/result';
import { HOUR_MS, OTHER_OWNER_ID, OWNER_ID, VIDEO_IDS, publicVideo } from './fixtures';
import type { RepositoriesSubject } from './subjects';

export interface PlaylistContractContext {
  readonly subject: RepositoriesSubject;
  readonly playlists: PlaylistRepositoryPort;
}

export const OWNER: UserContext = { id: OWNER_ID, role: 'USER' };
export const STRANGER: UserContext = { id: OTHER_OWNER_ID, role: 'USER' };

export const P = {
  mix: '00000000-0000-7000-8000-0000000001a1',
  other: '00000000-0000-7000-8000-0000000001a2',
  watchLater: '00000000-0000-7000-8000-0000000001a3',
  absent: '00000000-0000-7000-8000-0000000001af',
} as const;

export const FIVE = [VIDEO_IDS.a, VIDEO_IDS.b, VIDEO_IDS.c, VIDEO_IDS.d, VIDEO_IDS.e];

export const AN_HOUR_AGO = new Date(Date.now() - HOUR_MS);
export const TWO_HOURS_AGO = new Date(Date.now() - 2 * HOUR_MS);

export async function seedPlaylist(
  ctx: PlaylistContractContext,
  id: string,
  visibility: PlaylistVisibility = 'private'
): Promise<void> {
  expectOk(
    await ctx.playlists.create({ id, ownerId: OWNER_ID, title: 'Mix', description: '', visibility })
  );
}

export async function seedVideos(ctx: PlaylistContractContext): Promise<void> {
  for (const id of Object.values(VIDEO_IDS)) {
    await ctx.subject.repositories.videos.create(publicVideo({ id }));
  }
}

export function itemIdFor(videoId: string): string {
  return `00000000-0000-7000-8000-0000000002${videoId.slice(-2)}`;
}

export async function addAll(ctx: PlaylistContractContext, videoIds: readonly string[]) {
  for (const videoId of videoIds) {
    expect(expectOk(await ctx.playlists.addItem(P.mix, { id: itemIdFor(videoId), videoId }))).toBe(
      'added'
    );
  }
}

export async function orderOf(ctx: PlaylistContractContext, viewer = OWNER): Promise<string[]> {
  const detail = expectOk(await ctx.playlists.findDetail(P.mix, viewer));
  return detail?.items.map((item) => item.videoId) ?? [];
}
