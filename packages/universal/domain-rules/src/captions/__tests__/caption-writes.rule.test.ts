import { MAX_CAPTION_TRACKS } from '@vp/domain';
import { ErrorCodes } from '@vp/errors';
import { expectErr, expectOk } from '@vp/testing/result';
import { aCaptionTrack } from '../../__tests__/entities';
import { decideCaptionGenerate, decideCaptionUpload } from '../caption-writes.rule';

const uploads = (count: number) =>
  Array.from({ length: count }, (_, index) =>
    aCaptionTrack({ id: `c${index}`, language: `l${index}`, kind: 'uploaded' })
  );

describe('@vp/domain-rules: decideCaptionUpload', () => {
  it.each([
    { name: 'a new language under the limit', held: MAX_CAPTION_TRACKS - 1, language: 'fr' },
    { name: 'a replacement at the limit', held: MAX_CAPTION_TRACKS, language: 'l0' },
  ])('accepts $name', ({ held, language }) => {
    expectOk(decideCaptionUpload('video-1', uploads(held), language));
  });

  it('refuses a new language past the limit', () => {
    expect(
      expectErr(decideCaptionUpload('video-1', uploads(MAX_CAPTION_TRACKS), 'fr'))
    ).toMatchObject({ code: ErrorCodes.CAPTION_TRACK_LIMIT, limit: MAX_CAPTION_TRACKS });
  });
});

describe('@vp/domain-rules: decideCaptionGenerate', () => {
  const german = aCaptionTrack({ id: 'de', language: 'de', kind: 'uploaded' });

  it.each([
    {
      name: 'no generated track yet',
      tracks: [german],
      language: null,
      overwrite: false,
      replaces: null,
    },
    {
      name: 'an auto track',
      tracks: [aCaptionTrack({ kind: 'auto' })],
      language: null,
      overwrite: false,
      replaces: 'caption-1',
    },
    {
      name: 'an edited track, confirmed',
      tracks: [aCaptionTrack({ kind: 'edited' })],
      language: null,
      overwrite: true,
      replaces: 'caption-1',
    },
    {
      name: 'the generated track own language as hint',
      tracks: [aCaptionTrack(), german],
      language: 'en',
      overwrite: false,
      replaces: 'caption-1',
    },
  ])('starts a run over $name', ({ tracks, language, overwrite, replaces }) => {
    const generated = expectOk(decideCaptionGenerate('video-1', tracks, { language, overwrite }));

    expect(generated?.id ?? null).toBe(replaces);
  });

  it.each([
    {
      name: 'an edited track, unconfirmed',
      tracks: [aCaptionTrack({ kind: 'edited' })],
      language: null,
      code: ErrorCodes.CAPTION_OVERWRITE_UNCONFIRMED,
    },
    {
      name: 'a hint another track holds',
      tracks: [aCaptionTrack(), german],
      language: 'de',
      code: ErrorCodes.VALIDATION_FAILED,
    },
  ])('refuses $name with $code', ({ tracks, language, code }) => {
    expect(
      expectErr(decideCaptionGenerate('video-1', tracks, { language, overwrite: false })).code
    ).toBe(code);
  });
});
