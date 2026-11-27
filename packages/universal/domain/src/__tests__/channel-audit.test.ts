import { CHANNEL_AUDIT_ACTIONS, VIDEO_AUDIT_FIELDS, videoEditAudit } from '../channel-audit';

describe('@vp/domain: channel audit', () => {
  it('names the video fields an audit row can carry', () => {
    expect(VIDEO_AUDIT_FIELDS).toEqual([
      'title',
      'description',
      'visibility',
      'categoryId',
      'tags',
      'thumbnail',
      'chapters',
    ]);
  });

  it.each([
    'video.comments.toggled',
    'video.restored',
    'comment.held',
    'comment.approved',
    'comment.hidden',
    'comment.unhidden',
    'comment.removed',
    'comment.pinned',
    'user.shadow_banned',
    'user.banned',
    'user.restriction_lifted',
    'trusted.added',
    'trusted.removed',
    'settings.comments.updated',
    'export.requested',
    'export.deleted',
  ] as const)('audits %s', (action) => {
    expect(CHANNEL_AUDIT_ACTIONS).toContain(action);
  });

  it.each([
    { scenario: 'fields only', edit: { fields: ['title'] }, actions: ['video.updated'] },
    {
      scenario: 'a toggle only',
      edit: { fields: [], commentsEnabled: false },
      actions: ['video.comments.toggled'],
    },
    {
      scenario: 'both, as two rows',
      edit: { fields: ['tags'], commentsEnabled: true },
      actions: ['video.updated', 'video.comments.toggled'],
    },
    {
      scenario: 'a restore, as its own row first',
      edit: { fields: ['chapters'], restoredFromVersion: 3 },
      actions: ['video.restored', 'video.updated'],
    },
    { scenario: 'nothing', edit: { fields: [] }, actions: [] },
  ] as const)('audits an edit of $scenario', ({ edit, actions }) => {
    const events = videoEditAudit({ videoId: 'v', ...edit, fields: [...edit.fields] });

    expect(events.map(({ action }) => action)).toEqual(actions);
  });
});
