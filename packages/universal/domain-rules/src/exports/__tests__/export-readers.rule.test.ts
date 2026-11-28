import { exportReaders } from '../export-readers.rule';

const members = [
  { userId: 'manager-1', role: 'manager' as const },
  { userId: 'analyst-1', role: 'analytics' as const },
  { userId: 'editor-1', role: 'editor' as const },
  { userId: 'mod-1', role: 'moderator' as const },
];

describe('@vp/domain-rules: exportReaders', () => {
  it.each([
    { kind: 'comments' as const, readers: ['owner-1', 'manager-1'] },
    { kind: 'video_analytics' as const, readers: ['owner-1', 'manager-1', 'analyst-1'] },
  ])('names the owner and the members who read a $kind export', ({ kind, readers }) => {
    expect(exportReaders({ channelId: 'chan-1', ownerId: 'owner-1', kind, members })).toEqual(
      readers
    );
  });

  it('names the owner once when the owner also appears as a member', () => {
    expect(
      exportReaders({
        channelId: 'chan-1',
        ownerId: 'owner-1',
        kind: 'comments',
        members: [{ userId: 'owner-1', role: 'manager' }],
      })
    ).toEqual(['owner-1']);
  });
});
