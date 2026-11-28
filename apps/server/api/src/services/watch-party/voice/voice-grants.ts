import type { VoiceGrants } from '@vp/core/ports';
import type { EffectivePermissions, RosterEntry, RoomRole, WatchPartyMemberRole } from '@vp/domain';

/** Listening takes `voice.join`, publishing audio `voice.speak` on top of it; nothing else is ever granted. */
export function voiceGrantsOf({
  permissions,
}: Pick<EffectivePermissions, 'permissions'>): VoiceGrants {
  const canSubscribe = permissions.includes('voice.join');
  return { canSubscribe, canPublish: canSubscribe && permissions.includes('voice.speak') };
}

/** Whether an unexpired Voice muted row is on the member, which is what the roster calls server-muted. */
export function isServerMuted(
  roles: readonly Pick<RoomRole, 'id' | 'key'>[],
  assignments: readonly Pick<WatchPartyMemberRole, 'roleId' | 'expiresAt'>[],
  now: Date
): boolean {
  const muted = roles.find((role) => role.key === 'voice_muted');
  return (
    muted !== undefined &&
    assignments.some(
      ({ roleId, expiresAt }) => roleId === muted.id && (expiresAt === null || expiresAt > now)
    )
  );
}

export function voiceStateOf(grants: VoiceGrants, serverMuted: boolean): RosterEntry['voice'] {
  if (serverMuted) return 'server_muted';
  return grants.canPublish ? 'live' : 'listening';
}
