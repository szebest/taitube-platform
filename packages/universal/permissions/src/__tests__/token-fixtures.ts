import { subject } from '@casl/ability';
import type { ApiScope, DataExportKind } from '@vp/domain';
import type { Role, UserContext } from '../types/index';

const channelOf = (ownerId: string) => `chan-of-${ownerId}`;
export const OWNER_ID = 'owner-1';
export const OWN_CHANNEL = channelOf(OWNER_ID);
export const SECOND_CHANNEL = 'chan-own-second';
export const TEAM_OWNER = 'owner-team';
export const TEAM_CHANNEL = channelOf(TEAM_OWNER);
export const OTHER_OWNER = 'owner-other';
const OTHER_CHANNEL = channelOf(OTHER_OWNER);

export const video = (ownerId: string, status = 'READY', channelId = channelOf(ownerId)) =>
  subject('Video', { id: 'vid-1', ownerId, channelId, visibility: 'private' as const, status });
export const comment = (videoOwnerId: string) =>
  subject('Comment', {
    id: 'c-1',
    authorId: 'fan-1',
    videoOwnerId,
    videoChannelId: channelOf(videoOwnerId),
  });
export const analytics = (ownerId: string, channelId = channelOf(ownerId)) =>
  subject('Analytics', { ownerId, channelId });
export const channelExport = (channelId: string, ownerId: string, kind: DataExportKind) =>
  subject('ChannelExport', { channelId, ownerId, kind });

export function tokenOf(
  scopes: readonly ApiScope[],
  overrides: Partial<UserContext> = {},
  channelId = OWN_CHANNEL
): UserContext {
  return {
    id: OWNER_ID,
    role: 'CREATOR',
    ...overrides,
    token: { id: 'tok-1', channelId, scopes },
  };
}

export const foreign = video(OTHER_OWNER);
export const as = (role: Role, scope: ApiScope) => tokenOf([scope], { role });
export const onTeam = (scope: ApiScope) => tokenOf([scope], manager, TEAM_CHANNEL);
export const publicVideo = subject('Video', {
  id: 'v-2',
  ownerId: OTHER_OWNER,
  visibility: 'public' as const,
});

export const manager: Partial<UserContext> = {
  memberships: {
    [TEAM_CHANNEL]: { role: 'manager', ownerId: TEAM_OWNER },
    [OTHER_CHANNEL]: { role: 'manager', ownerId: OTHER_OWNER },
  },
};
export const analyticsMember: Partial<UserContext> = {
  memberships: { [TEAM_CHANNEL]: { role: 'analytics', ownerId: TEAM_OWNER } },
};
