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

  it.each([
    { key: 'studio.deleteConfirmTitle', count: 1, expected: 'Delete this video?' },
    { key: 'studio.deleteConfirmTitle', count: 3, expected: 'Delete 3 videos?' },
  ] as const)('counts the videos of $key for $count', ({ key, count, expected }) => {
    expect(t(key, { count })).toEqual({ ok: true, value: expected });
  });

  it.each([
    { metric: 'views', range: '7d', expected: 'Views, last 7 days' },
    { metric: 'watch-time', range: '30d', expected: 'Watch time, last 30 days' },
    {
      metric: 'average-view-duration',
      range: '90d',
      expected: 'Average view duration, last 90 days',
    },
    { metric: 'views', range: 'lifetime', expected: 'Views, lifetime' },
    { metric: 'net-subscribers', range: '30d', expected: 'Net subscribers, last 30 days' },
  ] as const)('labels the $metric card for $range', ({ metric, range, expected }) => {
    expect(t('studio.kpiLabel', { metric, range })).toEqual({ ok: true, value: expected });
  });

  it.each([
    { range: '7d', expected: '7 days' },
    { range: '90d', expected: '90 days' },
    { range: 'lifetime', expected: 'Lifetime' },
  ] as const)('names the $range option', ({ range, expected }) => {
    expect(t('studio.analyticsRangeOption', { range })).toEqual({ ok: true, value: expected });
  });

  it.each([
    {
      key: 'studio.startHereDescription',
      args: { max: 6 },
      expected: 'Pin up to 6 videos, in the order a newcomer should watch them.',
    },
    {
      key: 'studio.startHereLimit',
      args: { max: 6 },
      expected: '6 videos are pinned, the most a shelf holds. Remove one to add another.',
    },
    { key: 'studio.startHereRemove', args: { title: 'Harbour' }, expected: 'Remove Harbour' },
    { key: 'studio.kpiChange', args: { change: '+8.4%' }, expected: '+8.4% vs previous period' },
    {
      key: 'studio.hourlyChartTitle',
      args: { hours: 48 },
      expected: 'Views per hour, last 48 hours',
    },
  ] as const)('fills $key', ({ key, args, expected }) => {
    expect(t(key, args)).toEqual({ ok: true, value: expected });
  });

  it('words the empty shelf as the fallback viewers get', () => {
    expect(t('studio.startHereEmptyNote')).toEqual({
      ok: true,
      value: 'Viewers see your most-watched videos until you pin some',
    });
  });
});
