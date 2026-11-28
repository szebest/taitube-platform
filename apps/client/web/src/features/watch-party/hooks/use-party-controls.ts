import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  isNoPersonalControl,
  NO_PERSONAL_CONTROL,
  type PersonalControl,
  type PersonalControlValues,
  resolvePersonalControl,
} from '@vp/domain';
import { useApi, watchPartyControlsKey, watchPartyControlsQueryOptions } from '@vp/queries';
import { z } from 'zod';
import { useStoredState } from '#app/hooks/use-stored-state';

export type PartyControlScope = 'room' | 'everywhere';

const StoredControlsSchema = z.array(
  z.object({
    targetKey: z.string(),
    roomId: z.string().nullable(),
    voiceMuted: z.boolean(),
    hideMessages: z.boolean(),
    hideReactions: z.boolean(),
    hideAvatar: z.boolean(),
    hideRequests: z.boolean(),
    blockInvites: z.boolean(),
    favourite: z.boolean(),
    volume: z.number(),
  })
);

const NO_CONTROLS: PersonalControl[] = [];

export const partyControlsStorageKey = (roomId: string) => `taitube:party-controls:${roomId}`;

/**
 * The viewer's own controls over the room's members. An account keeps them on the server (both
 * scopes); a guest or Discord member keeps this room's in the browser and has no everywhere scope.
 */
export function usePartyControls(roomId: string, kind: 'user' | 'guest' | 'discord' | undefined) {
  const api = useApi();
  const queryClient = useQueryClient();
  const account = kind === 'user';
  const remote = useQuery({ ...watchPartyControlsQueryOptions(api, roomId), enabled: account });
  const [stored, setStored] = useStoredState(
    partyControlsStorageKey(roomId),
    StoredControlsSchema,
    NO_CONTROLS
  );
  const put = useMutation({
    mutationFn: (control: PersonalControl) =>
      api.watchPartyControls.putWatchPartyControl({ body: control }),
    onSettled: () => queryClient.invalidateQueries({ queryKey: watchPartyControlsKey }),
  });
  const items: readonly PersonalControl[] = account ? (remote.data?.items ?? NO_CONTROLS) : stored;

  const rowRoom = (scope: PartyControlScope) => (scope === 'room' ? roomId : null);

  const scoped = (targetKey: string, scope: PartyControlScope): PersonalControlValues =>
    items.find((item) => item.targetKey === targetKey && item.roomId === rowRoom(scope)) ??
    NO_PERSONAL_CONTROL;

  const set = (
    targetKey: string,
    scope: PartyControlScope,
    patch: Partial<PersonalControlValues>
  ) => {
    const control = { targetKey, roomId: rowRoom(scope), ...scoped(targetKey, scope), ...patch };
    if (account) {
      put.mutate(control);
      return;
    }
    setStored((current) => {
      const others = current.filter(
        (item) => !(item.targetKey === targetKey && item.roomId === control.roomId)
      );
      return isNoPersonalControl(control) ? others : [...others, control];
    });
  };

  return {
    /** Everywhere is held on the account alone. */
    everywhereAllowed: account,
    scoped,
    resolved: (targetKey: string) => resolvePersonalControl(items, targetKey, roomId),
    set,
    /** The undo mark: hidden messages and mutes off in both scopes. */
    clear: (targetKey: string) => {
      for (const scope of ['room', 'everywhere'] as const) {
        const held = scoped(targetKey, scope);
        if (held.hideMessages || held.voiceMuted) {
          set(targetKey, scope, { hideMessages: false, voiceMuted: false });
        }
      }
    },
  };
}
