import { mutationOptions, useMutation } from '@tanstack/react-query';
import type { ApiClient } from '@vp/api-client';
import type { RoleExpiry } from '@vp/domain';
import { useApi } from '@vp/queries';
import { assertNever } from '@vp/result';

type PartyModeration =
  | { type: 'kick'; memberKey: string }
  | { type: 'ban'; memberKey: string }
  | { type: 'transfer'; memberKey: string }
  | { type: 'assign'; memberKey: string; roleId: string; expiresIn?: RoleExpiry }
  | { type: 'revoke'; memberKey: string; roleId: string };

function moderationMutationOptions(api: ApiClient, roomId: string) {
  return mutationOptions({
    mutationFn: (action: PartyModeration) => {
      const params = { id: roomId, memberKey: action.memberKey };
      switch (action.type) {
        case 'kick':
          return api.watchPartyMembers.kickWatchPartyMember({ params });
        case 'ban':
          return api.watchPartyMembers.banWatchPartyMember({ params, body: undefined });
        case 'transfer':
          return api.watchPartyMembers.transferWatchPartyOwnership({
            params: { id: roomId },
            body: { memberKey: action.memberKey },
          });
        case 'assign':
          return api.watchPartyRoles.assignWatchPartyRole({
            params: { ...params, roleId: action.roleId },
            body: { expiresIn: action.expiresIn },
          });
        case 'revoke':
          return api.watchPartyRoles.revokeWatchPartyRole({
            params: { ...params, roleId: action.roleId },
          });
        default:
          return assertNever(action, 'PartyModeration');
      }
    },
  });
}

/** What a moderator does to a member: the room's sockets hear the result, so nothing is invalidated. */
export function usePartyModeration(roomId: string) {
  const api = useApi();

  return useMutation(moderationMutationOptions(api, roomId));
}
