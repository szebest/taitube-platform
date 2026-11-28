import type { ChannelMembership, DataExportKind } from '@vp/domain';
import { type UserContext, canReadChannelExport } from '@vp/permissions';

export interface ExportReadersInput {
  readonly channelId: string;
  readonly ownerId: string;
  readonly kind: DataExportKind;
  readonly members: readonly Pick<ChannelMembership, 'userId' | 'role'>[];
}

/**
 * The user ids who may download an export of this kind on the channel: the owner, and each member
 * whose own ability reads it. The export is channel data, so who asked for it does not decide this.
 */
export function exportReaders({ channelId, ownerId, kind, members }: ExportReadersInput): string[] {
  const candidates: UserContext[] = [
    { id: ownerId, role: 'USER' },
    ...members.map(({ userId, role }) => ({
      id: userId,
      role: 'USER' as const,
      memberships: { [channelId]: { role, ownerId } },
    })),
  ];
  const readers = candidates
    .filter((user) => canReadChannelExport({ user, channelExport: { channelId, ownerId, kind } }))
    .map(({ id }) => id);
  return [...new Set(readers)];
}
