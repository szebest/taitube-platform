import { translatorFor } from '../../__tests__/fixtures';

describe('@vp/messages: en studio', () => {
  const { t } = translatorFor('en');

  it.each([
    { key: 'studio.title', expected: 'Creator Studio' },
    { key: 'studio.backToWeb', expected: 'Back to Taitube' },
    { key: 'studio.signIn', expected: 'Sign in to the studio' },
    { key: 'studio.processingStatus', expected: 'Processing status' },
    { key: 'studio.uploadTitle', expected: 'Upload a video' },
    { key: 'studio.processingStatusFailed', expected: 'The processing status did not load.' },
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

  it('names the video being edited', () => {
    expect(t('studio.editTitle', { title: 'Launch day' })).toEqual({
      ok: true,
      value: 'Editing video: Launch day',
    });
  });

  it.each([
    { key: 'studio.uploadSending', args: { title: 'Harbour' }, expected: 'Uploading Harbour' },
    { key: 'studio.uploadFailed', args: { title: 'Harbour' }, expected: 'Harbour did not upload' },
    {
      key: 'studio.uploadSendingDetail',
      args: { progress: '50%', sent: '4 byte', total: '8 byte' },
      expected: '50% · 4 byte / 8 byte',
    },
    {
      key: 'studio.uploadStageLabel',
      args: { stage: '720p', title: 'Harbour' },
      expected: '720p of Harbour',
    },
    { key: 'studio.editTagRemove', args: { tag: 'night' }, expected: 'Remove the tag night' },
  ] as const)('names the upload or tag in $key', ({ key, args, expected }) => {
    expect(t(key, args)).toEqual({ ok: true, value: expected });
  });
});
