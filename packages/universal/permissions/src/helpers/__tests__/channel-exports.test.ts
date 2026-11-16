import { type ChannelRole, DATA_EXPORT_KINDS, type DataExportKind } from '@vp/domain';
import type { UserContext } from '../../types/index';
import {
  canCreateChannelExport,
  canDeleteChannelExport,
  canReadChannelExport,
} from '../channel-exports';

const CHANNEL = { channelId: 'chan-1', ownerId: 'owner-1' };

const memberAs = (role: ChannelRole): UserContext => ({
  id: `${role}-1`,
  role: 'USER',
  memberships: { [CHANNEL.channelId]: { role, ownerId: CHANNEL.ownerId } },
});

const PERSONAS: [string, UserContext | null][] = [
  ['owner', { id: CHANNEL.ownerId, role: 'USER' }],
  ['manager', memberAs('manager')],
  ['editor', memberAs('editor')],
  ['moderator', memberAs('moderator')],
  ['analytics', memberAs('analytics')],
  ['outsider', { id: 'outsider-1', role: 'USER' }],
  ['anonymous', null],
];

const ALLOWED: Record<DataExportKind, string[]> = {
  video_analytics: ['owner', 'manager', 'analytics'],
  channel_analytics: ['owner', 'manager', 'analytics'],
  comments: ['owner', 'manager'],
  videos: ['owner', 'manager'],
};

const ASKS = [
  { action: 'create', ask: canCreateChannelExport },
  { action: 'read', ask: canReadChannelExport },
  { action: 'delete', ask: canDeleteChannelExport },
];

describe('helpers/channel-exports', () => {
  it.each(
    DATA_EXPORT_KINDS.flatMap((kind) =>
      ASKS.map(({ action, ask }) => ({ kind, action, ask, allowed: ALLOWED[kind] }))
    )
  )('$action a $kind export: only $allowed', ({ kind, ask, allowed }) => {
    const channelExport = { ...CHANNEL, kind };

    expect(
      PERSONAS.filter(([, user]) => ask({ user, channelExport })).map(([name]) => name)
    ).toEqual(allowed);
  });

  it('keeps a role on one channel off the exports of another', () => {
    const channelExport = { channelId: 'chan-2', ownerId: 'owner-2', kind: 'comments' as const };

    expect(canCreateChannelExport({ user: memberAs('manager'), channelExport })).toBe(false);
  });
});
