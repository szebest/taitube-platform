import { translatorFor } from '../../__tests__/fixtures';

describe('@vp/messages: en studio team', () => {
  const { t } = translatorFor('en');

  it.each([
    { key: 'studio.teamNav', args: undefined, expected: 'Team' },
    { key: 'studio.teamRole', args: { role: 'analytics' }, expected: 'Analytics viewer' },
    {
      key: 'studio.teamCapability',
      args: { capability: 'comment.moderate' },
      expected: 'Moderate comments',
    },
    {
      key: 'studio.teamAuditAction',
      args: { action: 'member.role_changed' },
      expected: 'Changed a role',
    },
    { key: 'studio.teamAuditAction', args: { action: 'comment.held' }, expected: 'Held a comment' },
    {
      key: 'studio.teamAuditDisclosure',
      args: { disclosure: 'visible' },
      expected: 'with the author told',
    },
    {
      key: 'studio.teamAuditSettingsFields',
      args: { fields: ['blockedWords', 'slowModeSeconds'] },
      expected: 'blockedWords and slowModeSeconds',
    },
    {
      key: 'studio.teamAuditRoleChanged',
      args: { from: 'editor', to: 'manager' },
      expected: 'from Editor to Manager',
    },
    {
      key: 'studio.teamAuditVideoFields',
      args: { fields: ['title', 'tags'] },
      expected: 'title and tags',
    },
  ] as const)('writes $key', ({ key, args, expected }) => {
    expect(t(key, ...(args ? [args] : []))).toEqual({ ok: true, value: expected });
  });
});
