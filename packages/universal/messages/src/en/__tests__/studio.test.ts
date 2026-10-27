import { translatorFor } from '../../__tests__/fixtures';

describe('@vp/messages: en studio', () => {
  const { t } = translatorFor('en');

  it.each([
    { key: 'studio.title', expected: 'Creator Studio' },
    { key: 'studio.backToWeb', expected: 'Back to Taitube' },
    { key: 'studio.signIn', expected: 'Sign in to the studio' },
    { key: 'studio.processingStatus', expected: 'Processing status' },
  ] as const)('renders $key with no arguments', ({ key, expected }) => {
    expect(t(key)).toEqual({ ok: true, value: expected });
  });

  it.each([
    { status: 'UPLOADING', overall: 0, expected: 'Uploading, 0% encoded' },
    { status: 'PROCESSING', overall: 42.6, expected: 'Processing, 43% encoded' },
    { status: 'READY', overall: 100, expected: 'Ready, 100% encoded' },
  ] as const)('renders the processing line of a $status video', ({ status, overall, expected }) => {
    expect(t('studio.processing', { status, overall })).toEqual({ ok: true, value: expected });
  });
});
