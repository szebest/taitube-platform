import { translatorFor } from '../../__tests__/fixtures';

describe('@vp/messages: en clips', () => {
  const { t } = translatorFor('en');

  it.each([
    {
      key: 'clips.dialogDescription',
      args: { min: 5, max: 60 },
      expected: 'Pick a stretch of 5 to 60 seconds. Anyone with the link plays just that part.',
    },
    {
      key: 'clips.rangeInvalid',
      args: { min: 5, max: 60 },
      expected: 'A clip runs from 5 to 60 seconds and stays inside the video',
    },
    {
      key: 'clips.rangeSummary',
      args: { start: '01:15', end: '01:35', length: '00:20' },
      expected: '01:15 to 01:35, 00:20 long',
    },
  ] as const)('renders $key with its arguments', ({ key, args, expected }) => {
    expect(t(key, args)).toEqual({ ok: true, value: expected });
  });

  it.each([
    { key: 'clips.clip', expected: 'Clip' },
    { key: 'clips.dialogTitle', expected: 'Clip this video' },
    { key: 'clips.rangeLabel', expected: 'Clip range' },
    { key: 'clips.startThumb', expected: 'Clip start' },
    { key: 'clips.endThumb', expected: 'Clip end' },
    { key: 'clips.titleLabel', expected: 'Title' },
    { key: 'clips.titleInvalid', expected: 'Give the clip a title of 1 to 100 characters' },
    { key: 'clips.save', expected: 'Save clip' },
    { key: 'clips.saved', expected: 'Clip saved, link copied' },
    { key: 'clips.savedCopyFailed', expected: 'Clip saved, but the link could not be copied' },
    { key: 'clips.saveFailed', expected: 'Your clip could not be saved' },
    { key: 'clips.fullVideo', expected: 'Watch the full video' },
    { key: 'clips.delete', expected: 'Delete clip' },
    { key: 'clips.deleteTitle', expected: 'Delete this clip?' },
    {
      key: 'clips.deleteDescription',
      expected: 'Its link stops working. The video is not affected.',
    },
    { key: 'clips.deleteConfirm', expected: 'Delete' },
    { key: 'clips.deleted', expected: 'Clip deleted' },
    { key: 'clips.deleteFailed', expected: 'The clip could not be deleted' },
    { key: 'clips.shelfTitle', expected: 'Clips' },
    { key: 'clips.shelfEmpty', expected: 'Clips you make from a video show up here' },
  ] as const)('renders $key with no arguments', ({ key, expected }) => {
    expect(t(key)).toEqual({ ok: true, value: expected });
  });
});
