import { reasonedAction } from '../reasoned-action';

const NOW = new Date('2026-11-10T09:00:00.000Z');

describe('apps/client/studio: reasonedAction', () => {
  it.each([
    {
      action: 'hide' as const,
      disclosure: 'silent' as const,
      note: undefined,
      expected: { action: 'hide', disclosure: 'silent', reason: 'hate', note: undefined },
    },
    {
      action: 'remove' as const,
      disclosure: 'visible' as const,
      note: 'Rule 2',
      expected: { action: 'remove', disclosure: 'visible', reason: 'hate', note: 'Rule 2' },
    },
    {
      action: 'hide' as const,
      disclosure: undefined,
      note: undefined,
      expected: { action: 'hide', reason: 'hate', note: undefined },
    },
    {
      action: 'ban' as const,
      disclosure: 'silent' as const,
      note: undefined,
      expected: { action: 'ban', reason: 'Hate', expiresAt: '2026-11-17T09:00:00.000Z' },
    },
    {
      action: 'ban' as const,
      disclosure: 'visible' as const,
      note: 'Last warning',
      expected: { action: 'ban', reason: 'Last warning', expiresAt: '2026-11-17T09:00:00.000Z' },
    },
  ])('builds $action from the dialog ($note)', ({ action, disclosure, note, expected }) => {
    const details = { reason: 'hate' as const, note, duration: '7d' as const };

    expect(reasonedAction(action, details, disclosure, 'Hate', NOW)).toEqual(expected);
  });

  it('ends a permanent ban never', () => {
    const details = { reason: 'spam' as const, note: undefined, duration: 'forever' as const };

    expect(reasonedAction('ban', details, 'silent', 'Spam', NOW)).toMatchObject({
      expiresAt: null,
    });
  });
});
