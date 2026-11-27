import { MS_PER_MINUTE } from '@kit/primitives';
import { type PlaylistActivity, coalescesWith, isRestorable } from '../playlist-activity';

const NOW = new Date('2026-11-26T12:00:00.000Z');
const minutesAgo = (minutes: number) => new Date(NOW.getTime() - minutes * MS_PER_MINUTE);

const reorder = { action: 'items_reordered' as const, actorUserId: 'a' };

describe('@vp/domain: playlist activity', () => {
  it.each([
    { scenario: 'no earlier row', latest: null, coalesces: false },
    {
      scenario: 'their reorder 4 minutes ago',
      latest: { ...reorder, createdAt: minutesAgo(4) },
      coalesces: true,
    },
    {
      scenario: 'their reorder 6 minutes ago',
      latest: { ...reorder, createdAt: minutesAgo(6) },
      coalesces: false,
    },
    {
      scenario: 'someone else reordering a minute ago',
      latest: { ...reorder, actorUserId: 'b', createdAt: minutesAgo(1) },
      coalesces: false,
    },
    {
      scenario: 'their add a minute ago',
      latest: { action: 'item_added' as const, actorUserId: 'a', createdAt: minutesAgo(1) },
      coalesces: false,
    },
  ])('folds a reorder into $scenario: $coalesces', ({ latest, coalesces }) => {
    expect(coalescesWith(latest, reorder, NOW)).toBe(coalesces);
  });

  it('never folds anything but a reorder', () => {
    const latest = { action: 'item_added' as const, actorUserId: 'a', createdAt: NOW };

    expect(coalescesWith(latest, { action: 'item_added', actorUserId: 'a' }, NOW)).toBe(false);
  });

  const removed = {
    itemId: 'i',
    videoId: 'v',
    title: null,
    addedBy: null,
    note: null,
    startMs: null,
    endMs: null,
  };
  const row = { id: 'r', playlistId: 'p', actorUserId: 'a', createdAt: NOW };

  it.each([
    { activity: { ...row, action: 'item_removed', target: removed }, restorable: true },
    { activity: { ...row, action: 'auto_removed', target: removed }, restorable: true },
    { activity: { ...row, action: 'items_reordered', target: { count: 2 } }, restorable: false },
  ] satisfies { activity: PlaylistActivity; restorable: boolean }[])(
    'restores $activity.action: $restorable',
    ({ activity, restorable }) => {
      expect(isRestorable(activity)).toBe(restorable);
    }
  );
});
