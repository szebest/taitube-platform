import { pl } from '..';
import { translatorFor } from '../../__tests__/fixtures';

describe('@vp/messages: pl studio team', () => {
  const { t } = translatorFor('pl', { pl });

  it.each([
    { key: 'studio.teamNav', args: undefined, expected: 'Zespół' },
    { key: 'studio.teamRole', args: { role: 'moderator' }, expected: 'Moderator' },
    {
      key: 'studio.teamAuditAction',
      args: { action: 'comment.held' },
      expected: 'Wstrzymał(a) komentarz',
    },
    {
      key: 'studio.teamAuditDisclosure',
      args: { disclosure: 'silent' },
      expected: 'po cichu',
    },
    {
      key: 'studio.teamAuditRoleChanged',
      args: { from: 'editor', to: 'manager' },
      expected: 'była: Edytor, jest: Menedżer',
    },
  ] as const)('writes $key', ({ key, args, expected }) => {
    expect(t(key, ...(args ? [args] : []))).toEqual({ ok: true, value: expected });
  });
});
