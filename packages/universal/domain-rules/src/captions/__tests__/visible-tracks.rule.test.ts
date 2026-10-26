import type { CaptionTrack } from '@vp/domain';
import { ErrorCodes } from '@vp/errors';
import { expectErr, expectOk } from '@vp/testing/result';
import { aCaptionTrack } from '../../__tests__/entities';
import { decideTranscriptTrack, visibleCaptionTracks } from '../visible-tracks.rule';

const generated = aCaptionTrack({ id: 'auto', language: 'en', kind: 'auto' });
const pending = aCaptionTrack({ id: 'pending', language: null, kind: 'auto', status: 'pending' });
const uploaded = aCaptionTrack({ id: 'de', language: 'de', kind: 'uploaded' });
const failed = aCaptionTrack({ id: 'pl', language: 'pl', kind: 'uploaded', status: 'failed' });

const ids = (tracks: CaptionTrack[]) => tracks.map((track) => track.id);

describe('@vp/domain-rules: visibleCaptionTracks', () => {
  it.each([
    {
      name: 'a viewer, switch following the channel',
      manager: false,
      autoCaptions: null,
      seen: ['auto', 'de'],
    },
    { name: 'a viewer, switch on', manager: false, autoCaptions: true, seen: ['auto', 'de'] },
    { name: 'a viewer, switch off', manager: false, autoCaptions: false, seen: ['de'] },
    {
      name: 'a manager, switch off',
      manager: true,
      autoCaptions: false,
      seen: ['auto', 'pending', 'de', 'pl'],
    },
  ])('shows $name $seen', ({ manager, autoCaptions, seen }) => {
    const visible = visibleCaptionTracks([generated, pending, uploaded, failed], {
      manager,
      autoCaptions,
    });

    expect(ids(visible)).toEqual(seen);
  });
});

describe('@vp/domain-rules: decideTranscriptTrack', () => {
  it.each([
    { name: 'the asked language', tracks: [uploaded, generated], language: 'de', id: 'de' },
    {
      name: 'the generated track by default',
      tracks: [uploaded, generated],
      language: null,
      id: 'auto',
    },
    {
      name: 'the first ready track without a generated one',
      tracks: [pending, uploaded],
      language: null,
      id: 'de',
    },
  ])('reads $name', ({ tracks, language, id }) => {
    expect(expectOk(decideTranscriptTrack('video-1', tracks, language)).id).toBe(id);
  });

  it.each([
    { name: 'a language no track holds', tracks: [generated], language: 'fr' },
    { name: 'a language whose track is not ready', tracks: [failed], language: 'pl' },
    { name: 'no ready track at all', tracks: [pending], language: null },
  ])('answers CAPTION_NOT_FOUND for $name', ({ tracks, language }) => {
    expect(expectErr(decideTranscriptTrack('video-1', tracks, language))).toMatchObject({
      code: ErrorCodes.CAPTION_NOT_FOUND,
      language,
    });
  });
});
