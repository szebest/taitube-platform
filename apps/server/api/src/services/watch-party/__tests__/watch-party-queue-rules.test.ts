import type { WatchPartyPermission } from '@vp/domain';
import { ErrorCodes } from '@vp/errors';
import { getWatchPartyPermissions } from '@vp/permissions';
import { expectErr, expectOk } from '@vp/testing/result';
import { decideQueuePending, decideQueueRemove } from '../watch-party-queue-rules';

const abilityOf = (...permissions: WatchPartyPermission[]) =>
  getWatchPartyPermissions(null, { permissions, topPosition: 0, isOwner: false, kind: 'user' });

const ME = 'user:me';

describe('decideQueuePending', () => {
  it.each([
    { held: ['queue.add'], pending: 0, adding: 3, allowed: true },
    { held: ['queue.add'], pending: 2, adding: 1, allowed: true },
    { held: ['queue.add'], pending: 3, adding: 1, allowed: false },
    { held: ['queue.add'], pending: 0, adding: 4, allowed: false },
    { held: ['queue.add', 'queue.reorder'], pending: 50, adding: 20, allowed: true },
  ] as { held: WatchPartyPermission[]; pending: number; adding: number; allowed: boolean }[])(
    'with $held, $pending pending and $adding more, allows: $allowed',
    ({ held, pending, adding, allowed }) => {
      const decided = decideQueuePending({ ability: abilityOf(...held), pending, adding });

      if (allowed) expectOk(decided);
      else {
        expect(expectErr(decided)).toMatchObject({
          code: ErrorCodes.WATCH_PARTY_PERMISSION_MISSING,
          permission: 'queue.reorder',
        });
      }
    }
  );
});

describe('decideQueueRemove', () => {
  const pending = { playedAt: null };
  const played = { playedAt: new Date() };

  it.each([
    { held: ['queue.add'], item: { addedBy: ME, ...pending }, allowed: true },
    { held: ['queue.add'], item: { addedBy: ME, ...played }, allowed: false },
    { held: ['queue.add'], item: { addedBy: 'user:you', ...pending }, allowed: false },
    { held: ['queue.remove'], item: { addedBy: 'user:you', ...pending }, allowed: true },
    { held: ['queue.remove'], item: { addedBy: 'user:you', ...played }, allowed: true },
    { held: ['queue.vote'], item: { addedBy: ME, ...pending }, allowed: false },
  ] as {
    held: WatchPartyPermission[];
    item: { addedBy: string; playedAt: Date | null };
    allowed: boolean;
  }[])(
    'with $held on an item by $item.addedBy played at $item.playedAt, allows: $allowed',
    ({ held, item, allowed }) => {
      const decided = decideQueueRemove({ ability: abilityOf(...held), memberKey: ME, item });

      if (allowed) expectOk(decided);
      else {
        expect(expectErr(decided)).toMatchObject({
          code: ErrorCodes.WATCH_PARTY_PERMISSION_MISSING,
          permission: 'queue.remove',
        });
      }
    }
  );
});
