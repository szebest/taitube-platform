import type { ChannelRepositoryPort } from '@vp/core/repositories';
import { memberKeyOf, parseMemberKey } from '@vp/domain';
import type { DatabaseUnavailable } from '@vp/errors';
import { map, ok, type Result } from '@vp/result';

export interface PartyPerson {
  readonly memberKey: string;
  readonly name: string;
  readonly avatarUrl: string | null;
}

export interface PartySnapshot {
  readonly displayName: string | null;
  readonly avatarUrl: string | null;
}

export type PersonOf = (memberKey: string) => PartyPerson;

const UNKNOWN_NAME = 'Member';

export async function resolvePeople(
  channels: Pick<ChannelRepositoryPort, 'findByUserIds'>,
  memberKeys: readonly string[],
  snapshots?: ReadonlyMap<string, PartySnapshot>
): Promise<Result<PersonOf, DatabaseUnavailable>> {
  const userIds = memberKeys.flatMap((key) => {
    const parsed = parseMemberKey(key);
    return parsed?.kind === 'user' ? [parsed.id] : [];
  });
  const found = userIds.length === 0 ? ok([]) : await channels.findByUserIds(userIds);

  return map(found, (rows) => {
    const sources = new Map<string, PartySnapshot>(snapshots ?? []);
    for (const channel of rows) {
      sources.set(memberKeyOf({ kind: 'user', userId: channel.userId }), channel);
    }
    return (memberKey) => ({
      memberKey,
      name: sources.get(memberKey)?.displayName ?? UNKNOWN_NAME,
      avatarUrl: sources.get(memberKey)?.avatarUrl ?? null,
    });
  });
}
