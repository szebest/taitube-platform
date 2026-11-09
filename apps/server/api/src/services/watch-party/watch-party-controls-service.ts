import type { PersonalControlView, putWatchPartyControl } from '@vp/api-contracts';
import { NO_PERSONAL_CONTROL, type PersonalControlRecord, parseMemberKey } from '@vp/domain';
import { andThenAsync, err, map, ok, type Result } from '@vp/result';
import { type InvalidField, invalidField } from '@vp/validation';
import type { z } from 'zod';
import type { WatchPartyDeps } from './watch-party-deps';

export type PutControlInput = z.output<typeof putWatchPartyControl.body>;

/** A guest key dies with its seat, so a control on one has no everywhere scope. */
function validTarget({ targetKey, roomId }: PutControlInput): Result<void, InvalidField> {
  const target = parseMemberKey(targetKey);
  if (target === null) return err(invalidField('targetKey', 'targetKey is not a member key', {}));
  return target.kind === 'guest' && roomId === null
    ? err(invalidField('roomId', 'a guest can only be controlled in a room', {}))
    : ok(undefined);
}

function toControlView(record: PersonalControlRecord): PersonalControlView {
  const { userId: _userId, updatedAt: _updatedAt, ...control } = record;
  return control;
}

const byTargetThenScope = (a: PersonalControlView, b: PersonalControlView) =>
  a.targetKey.localeCompare(b.targetKey) || (a.roomId ?? '').localeCompare(b.roomId ?? '');

function toControlList(records: readonly PersonalControlRecord[]) {
  return { items: records.map(toControlView).sort(byTargetThenScope) };
}

export class WatchPartyControlsService {
  constructor(private readonly deps: WatchPartyDeps) {}

  async list(userId: string, roomId: string | null) {
    const records = await this.deps.repositories.watchPartyControls.list(userId, roomId);
    return map(records, toControlList);
  }

  async put(userId: string, input: PutControlInput) {
    return andThenAsync(validTarget(input), () =>
      andThenAsync(this.roomOf(input.roomId), async () => {
        const { watchPartyControls } = this.deps.repositories;
        const current = await watchPartyControls.list(userId, input.roomId);
        return andThenAsync(current, async (rows) => {
          const stored = rows.find(
            ({ targetKey, roomId }) => targetKey === input.targetKey && roomId === input.roomId
          );
          const record: PersonalControlRecord = {
            ...NO_PERSONAL_CONTROL,
            ...stored,
            ...input,
            userId,
            updatedAt: this.deps.now(),
          };
          const written = await watchPartyControls.put(record);
          return andThenAsync(written, () => this.list(userId, input.roomId));
        });
      })
    );
  }

  private async roomOf(roomId: string | null) {
    if (roomId === null) return ok(undefined);
    const room = await this.deps.repositories.watchPartyRooms.findById(roomId);
    return andThenAsync(room, (found) =>
      found === null
        ? err(invalidField('roomId', 'roomId names no watch party', {}))
        : ok(undefined)
    );
  }
}
