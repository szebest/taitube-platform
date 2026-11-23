import { translatorFor } from '../../__tests__/studio-fixtures';

describe('@vp/messages: en studio developers', () => {
  const { t } = translatorFor('en');

  it.each([
    { key: 'studio.developersNav', args: undefined, expected: 'Developers' },
    { key: 'studio.webhooksTestStatus', args: { status: 410 }, expected: 'It answered 410.' },
    { key: 'studio.exportRows', args: { count: 1 }, expected: '1 row' },
    { key: 'studio.exportRows', args: { count: 1200 }, expected: '1,200 rows' },
    {
      key: 'studio.exportsReady',
      args: { kind: 'Comments' },
      expected: 'Your Comments export is ready',
    },
    { key: 'studio.copiedField', args: { label: 'Token' }, expected: 'Copied: Token' },
    { key: 'studio.teamAuditViaToken', args: undefined, expected: 'with a token' },
  ] as const)('writes $key', ({ key, args, expected }) => {
    expect(t(key, ...(args ? [args] : []))).toEqual({ ok: true, value: expected });
  });

  it('words a webhook event', () => {
    expect(t('studio.webhookEvent', { event: 'comment.held' })).toEqual({
      ok: true,
      value: 'Comment held',
    });
  });
});
