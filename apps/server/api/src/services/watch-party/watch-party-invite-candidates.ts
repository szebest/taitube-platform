import type { listWatchPartyInviteCandidates } from '@vp/api-contracts';
import { searchHandleOf, type WatchPartyInvite } from '@vp/domain';
import { requireRoomPermission } from '@vp/domain-rules';
import { MS_PER_DAY } from '@vp/domain/time';
import type { DatabaseUnavailable } from '@vp/errors';
import { andThenAsync, isErr, map, ok, type Result } from '@vp/result';
import { type InvalidSearchQuery, validateSearchQuery } from '@vp/validation';
import type { z } from 'zod';
import type { PartyCaller } from './party-caller';
import type { WatchPartyDeps } from './watch-party-deps';
import { actingAsMember } from './watch-party-seated-actions';

type InviteCandidateView = z.output<typeof listWatchPartyInviteCandidates.result>['items'][number];

const CO_WATCHER_WINDOW_MS = 30 * MS_PER_DAY;

type Reason = InviteCandidateView['reason'];

/** @internal */
export interface CandidatePerson {
  readonly userId: string;
  readonly handle: string;
  readonly displayName: string;
  readonly avatarUrl: string | null;
}

export interface CandidateSources {
  readonly selfId: string;
  readonly limit: number;
  readonly prefix: string | null;
  readonly coWatchers: readonly CandidatePerson[];
  readonly subscriptions: readonly CandidatePerson[];
  readonly matches: readonly CandidatePerson[];
  readonly inRoom: ReadonlySet<string>;
  readonly invited: ReadonlySet<string>;
}

const startsWith = (person: CandidatePerson, prefix: string) =>
  person.handle.toLowerCase().startsWith(prefix) ||
  person.displayName.toLowerCase().startsWith(prefix);

/**
 * @internal
 * People worth inviting, each once under the first reason that names them: people from recent
 * parties, then owners of channels the caller subscribes to, then a prefix match. A query narrows
 * the first two to the people it matches.
 */
export function pickCandidates(sources: CandidateSources): InviteCandidateView[] {
  const { selfId, prefix, inRoom, invited } = sources;
  const narrowed = (people: readonly CandidatePerson[]) =>
    prefix === null ? people : people.filter((person) => startsWith(person, prefix));
  const ranked: [Reason, readonly CandidatePerson[]][] = [
    ['co_watcher', narrowed(sources.coWatchers)],
    ['subscription', narrowed(sources.subscriptions)],
    ['match', sources.matches],
  ];
  const seen = new Set<string>([selfId]);
  const picked: InviteCandidateView[] = [];
  for (const [reason, people] of ranked) {
    for (const person of people) {
      if (seen.has(person.userId)) continue;
      seen.add(person.userId);
      picked.push({
        userId: person.userId,
        handle: person.handle,
        displayName: person.displayName,
        avatarUrl: person.avatarUrl,
        reason,
        inRoom: inRoom.has(person.userId),
        invited: invited.has(person.userId),
      });
    }
  }
  return picked.slice(0, sources.limit);
}

function isInvited(invite: WatchPartyInvite, now: Date): boolean {
  return invite.status === 'joined' || invite.expiresAt > now;
}

type CandidateDeps = Pick<WatchPartyDeps, 'repositories' | 'context' | 'now' | 'config'>;

async function gatherSources(
  { repositories, now, config }: CandidateDeps,
  roomId: string,
  userId: string,
  prefix: string | null
): Promise<Result<CandidateSources, DatabaseUnavailable>> {
  const { watchPartyMembers, watchPartyInvites, channels, subscriptions, search } = repositories;
  const at = now();
  const limit = config.inviteCandidates;
  const pool = 2 * limit;
  const since = new Date(at.getTime() - CO_WATCHER_WINDOW_MS);
  const [coWatcherIds, subscribed, matches, seated, invites] = await Promise.all([
    watchPartyMembers.coWatchersOf(userId, since, pool),
    subscriptions.listUserSubscriptions(userId, { limit: pool }),
    prefix === null ? ok([]) : search.suggestChannels(prefix, pool),
    watchPartyMembers.listSeated(roomId),
    watchPartyInvites.listForRoom(roomId),
  ]);
  if (isErr(coWatcherIds)) return coWatcherIds;
  if (isErr(subscribed)) return subscribed;
  if (isErr(matches)) return matches;
  if (isErr(seated)) return seated;
  if (isErr(invites)) return invites;
  const coWatchers = await channels.findByUserIds(coWatcherIds.value);
  if (isErr(coWatchers)) return coWatchers;

  const rank = new Map(coWatcherIds.value.map((id, index) => [id, index]));
  return ok({
    selfId: userId,
    limit,
    prefix,
    coWatchers: [...coWatchers.value].sort(
      (a, b) => (rank.get(a.userId) ?? 0) - (rank.get(b.userId) ?? 0)
    ),
    subscriptions: subscribed.value,
    matches: matches.value,
    inRoom: new Set(seated.value.flatMap(({ userId: seatedId }) => seatedId ?? [])),
    invited: new Set(
      invites.value.filter((invite) => isInvited(invite, at)).map(({ inviteeId }) => inviteeId)
    ),
  });
}

/** The normalized text of a query, as a channel prefix; blank asks for no match at all. */
function queryPrefix(q: string | undefined): Result<string | null, InvalidSearchQuery> {
  if (q === undefined || q.trim() === '') return ok(null);
  return map(validateSearchQuery(q), searchHandleOf);
}

export function listInviteCandidates(
  deps: CandidateDeps,
  roomId: string,
  caller: PartyCaller,
  userId: string,
  q: string | undefined
) {
  return actingAsMember(deps.context, roomId, caller, (context) =>
    andThenAsync(requireRoomPermission(context.ability, 'members.invite'), () =>
      andThenAsync(queryPrefix(q), async (prefix) => {
        const sources = await gatherSources(deps, roomId, userId, prefix);
        return map(sources, (found) => ({ items: pickCandidates(found) }));
      })
    )
  );
}
