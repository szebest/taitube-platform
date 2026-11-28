import { assertNever } from '@kit/result';
import { mutationOptions, useMutation } from '@tanstack/react-query';
import type { ApiClient } from '@vp/api-client';
import type { WatchPartyPermission, WatchPartyPreset } from '@vp/domain';
import { useApi } from '@vp/queries';

export type PartyRoleEdit =
  | { type: 'create'; name: string; permissions?: WatchPartyPermission[] }
  | {
      type: 'update';
      roleId: string;
      updatedAt: string;
      name?: string;
      colour?: string | null;
      permissions?: WatchPartyPermission[];
    }
  | { type: 'delete'; roleId: string }
  | { type: 'preset'; preset: WatchPartyPreset };

function roleEditOptions(api: ApiClient, roomId: string) {
  return mutationOptions({
    mutationFn: async (edit: PartyRoleEdit): Promise<void> => {
      const params = { id: roomId };
      switch (edit.type) {
        case 'create':
          await api.watchPartyRoles.createWatchPartyRole({
            params,
            body: { name: edit.name, kind: 'grant', permissions: edit.permissions ?? [] },
          });
          break;
        case 'update':
          await api.watchPartyRoles.updateWatchPartyRole({
            params: { ...params, roleId: edit.roleId },
            body: {
              name: edit.name,
              colour: edit.colour,
              permissions: edit.permissions,
              updatedAt: edit.updatedAt,
            },
          });
          break;
        case 'delete':
          await api.watchPartyRoles.deleteWatchPartyRole({
            params: { ...params, roleId: edit.roleId },
          });
          break;
        case 'preset':
          await api.watchPartyRoles.applyWatchPartyPreset({
            params,
            body: { preset: edit.preset },
          });
          break;
        default:
          return assertNever(edit, 'PartyRoleEdit');
      }
    },
  });
}

/** What a role editor does to the room's roles: the sockets send the new list, so nothing is invalidated. */
export function usePartyRoleEdits(roomId: string) {
  const api = useApi();

  return useMutation(roleEditOptions(api, roomId));
}
