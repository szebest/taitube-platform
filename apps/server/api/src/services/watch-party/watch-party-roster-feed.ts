import type { WatchPartyServerFrame } from '@vp/api-contracts';
import { parseMemberKey, type RosterEntry, rosterFor } from '@vp/domain';
import { isErr } from '@vp/result';
import type { WatchPartyDeps } from './watch-party-deps';
import { announce } from './watch-party-moderation-effects';

type RosterPatch = Extract<WatchPartyServerFrame, { type: 'roster.patch' }>;

export type RosterChange =
  | { readonly type: 'upsert'; readonly entry: RosterEntry }
  | { readonly type: 'removal'; readonly memberKey: string };

type RosterEntryView = RosterPatch['upserts'][number];

export function rosterEntryView(entry: RosterEntry): RosterEntryView {
  return { ...entry, roleIds: [...entry.roleIds] };
}

const keyOf = (change: RosterChange) =>
  change.type === 'upsert' ? change.entry.memberKey : change.memberKey;

/** One window's changes as one patch, the latest per member, with the room's guest count. */
export function flushRoster(deps: Pick<WatchPartyDeps, 'repositories' | 'broadcaster' | 'logger'>) {
  return async (roomId: string, changes: readonly RosterChange[]): Promise<void> => {
    const latest = new Map(changes.map((change) => [keyOf(change), change]));
    const seated = await deps.repositories.watchPartyMembers.listSeated(roomId);
    if (isErr(seated)) {
      deps.logger.warn({ err: seated.error, roomId }, 'roster patch not published');
      return;
    }
    await announce(deps, roomId, {
      type: 'roster.patch',
      upserts: [...latest.values()].flatMap((change) =>
        change.type === 'upsert' ? [rosterEntryView(change.entry)] : []
      ),
      removals: [...latest.values()].flatMap((change) =>
        change.type === 'removal' ? [change.memberKey] : []
      ),
      guests: seated.value.filter(({ kind }) => kind === 'guest').length,
    });
  };
}

/** Guests stay one count for a socket whose holder may not remove them. */
export function rosterPatchFor(patch: RosterPatch, seesGuests: boolean): RosterPatch {
  if (seesGuests) return patch;
  return {
    ...patch,
    upserts: rosterFor(patch.upserts, false).entries.map(rosterEntryView),
    removals: patch.removals.filter((key) => parseMemberKey(key)?.kind !== 'guest'),
  };
}
