import { isErr, isOk } from '@kit/result';
import { ErrorCodes } from '@vp/errors';
import { type PostPayloadInput, validatePostPayload } from '../payload';

const image = (alt = 'A cat'): { uploadId: string; alt: string } => ({ uploadId: 'up-1', alt });
const images = (count: number): { uploadId: string; alt: string }[] =>
  Array.from({ length: count }, () => image());

describe('@vp/validation: validatePostPayload', () => {
  it.each<{ name: string; input: PostPayloadInput; normalized: PostPayloadInput }>([
    {
      name: 'a padded text',
      input: { kind: 'text', text: '  hello \n' },
      normalized: { kind: 'text', text: 'hello' },
    },
    {
      name: 'a text of 2000 characters',
      input: { kind: 'text', text: 'a'.repeat(2000) },
      normalized: { kind: 'text', text: 'a'.repeat(2000) },
    },
    {
      name: 'four images with a caption of 2000 characters',
      input: { kind: 'images', images: images(4), caption: 'c'.repeat(2000) },
      normalized: { kind: 'images', images: images(4), caption: 'c'.repeat(2000) },
    },
    {
      name: 'an alt of 200 characters, padded',
      input: { kind: 'images', images: [image(` ${'a'.repeat(200)} `)], caption: null },
      normalized: { kind: 'images', images: [image('a'.repeat(200))], caption: null },
    },
    {
      name: 'a blank caption, which becomes null',
      input: { kind: 'images', images: images(1), caption: '   ' },
      normalized: { kind: 'images', images: images(1), caption: null },
    },
    {
      name: 'a video share with a comment of 500 characters and an offset',
      input: { kind: 'video_share', videoId: 'v-1', comment: 'a'.repeat(500), startMs: 0 },
      normalized: { kind: 'video_share', videoId: 'v-1', comment: 'a'.repeat(500), startMs: 0 },
    },
    {
      name: 'a video share with a blank comment and no offset',
      input: { kind: 'video_share', videoId: 'v-1', comment: ' ', startMs: null },
      normalized: { kind: 'video_share', videoId: 'v-1', comment: null, startMs: null },
    },
    {
      name: 'a playlist share with a padded comment',
      input: { kind: 'playlist_share', playlistId: 'p-1', comment: ' nice ' },
      normalized: { kind: 'playlist_share', playlistId: 'p-1', comment: 'nice' },
    },
    {
      name: 'a playlist share without a comment',
      input: { kind: 'playlist_share', playlistId: 'p-1', comment: null },
      normalized: { kind: 'playlist_share', playlistId: 'p-1', comment: null },
    },
  ])('accepts $name', ({ input, normalized }) => {
    const result = validatePostPayload(input);

    expect(isOk(result) && result.value).toEqual(normalized);
  });

  it.each<{ name: string; input: PostPayloadInput; field: string }>([
    { name: 'a blank text', input: { kind: 'text', text: '  ' }, field: 'text' },
    {
      name: 'a text of 2001 characters',
      input: { kind: 'text', text: 'a'.repeat(2001) },
      field: 'text',
    },
    {
      name: 'no images',
      input: { kind: 'images', images: [], caption: null },
      field: 'images',
    },
    {
      name: 'five images',
      input: { kind: 'images', images: images(5), caption: null },
      field: 'images',
    },
    {
      name: 'a blank alt on the second image',
      input: { kind: 'images', images: [image(), image('  ')], caption: null },
      field: 'images.1.alt',
    },
    {
      name: 'an alt of 201 characters',
      input: { kind: 'images', images: [image('a'.repeat(201))], caption: null },
      field: 'images.0.alt',
    },
    {
      name: 'a caption of 2001 characters',
      input: { kind: 'images', images: images(1), caption: 'a'.repeat(2001) },
      field: 'caption',
    },
    {
      name: 'a video comment of 501 characters',
      input: { kind: 'video_share', videoId: 'v-1', comment: 'a'.repeat(501), startMs: null },
      field: 'comment',
    },
    {
      name: 'a negative offset',
      input: { kind: 'video_share', videoId: 'v-1', comment: null, startMs: -1 },
      field: 'startMs',
    },
    {
      name: 'a fractional offset',
      input: { kind: 'video_share', videoId: 'v-1', comment: null, startMs: 1.5 },
      field: 'startMs',
    },
    {
      name: 'a playlist comment of 501 characters',
      input: { kind: 'playlist_share', playlistId: 'p-1', comment: 'a'.repeat(501) },
      field: 'comment',
    },
  ])('rejects $name', ({ input, field }) => {
    const result = validatePostPayload(input);

    expect(isErr(result) && result.error).toMatchObject({
      code: ErrorCodes.VALIDATION_FAILED,
      field,
    });
  });
});
