import {
  VIDEO_FILE_ACCEPT,
  validateVideoDescription,
  validateVideoFile,
  validateVideoTitle,
} from '../video-field-validators';

const clip = (type: string) => new File(['bytes'], 'clip', { type });

describe('apps/client/web: video field validators', () => {
  it.each([
    { title: 'Launch day', error: undefined },
    { title: '', error: 'title must be between 1 and 255 characters' },
    { title: 'x'.repeat(256), error: 'title must be between 1 and 255 characters' },
  ])('checks a title of $title.length characters', ({ title, error }) => {
    expect(validateVideoTitle({ value: title })).toBe(error);
  });

  it.each([
    { description: '', error: undefined },
    { description: 'x'.repeat(4001), error: 'Description must be at most 4000 characters' },
  ])('checks a description of $description.length characters', ({ description, error }) => {
    expect(validateVideoDescription({ value: description })).toBe(error);
  });

  it.each([
    { file: 'none yet', files: [], valid: true },
    { file: 'an mp4', files: [clip('video/mp4')], valid: true },
    { file: 'a matroska file', files: [clip('video/x-matroska')], valid: true },
    { file: 'an image', files: [clip('image/png')], valid: false },
  ])('accepts $file as the upload: $valid', ({ files, valid }) => {
    expect(validateVideoFile({ value: files }) === undefined).toBe(valid);
  });

  it('offers the dropzone every container the API accepts', () => {
    expect(Object.keys(VIDEO_FILE_ACCEPT)).toEqual([
      'video/mp4',
      'video/webm',
      'video/quicktime',
      'video/x-matroska',
    ]);
  });
});
