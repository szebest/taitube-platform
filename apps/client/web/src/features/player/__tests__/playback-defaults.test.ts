import { findDefaultCaptionTrack, findDefaultRendition } from '../playback-defaults';

const P480 = { id: '0', height: 480 };
const P720 = { id: '1', height: 720 };
const P1080 = { id: '2', height: 1080 };
const LADDER = [P480, P720, P1080];

describe('apps/client/web: findDefaultRendition', () => {
  it.each([
    { scenario: 'a rung the master lists', renditions: LADDER, quality: '720p', id: '1' },
    {
      scenario: 'a rung above the master',
      renditions: [P480, P720],
      quality: '1080p',
      id: '1',
    },
    {
      scenario: 'a rung between two',
      renditions: [P480, P1080],
      quality: '720p',
      id: '0',
    },
    {
      scenario: 'a rung below every rendition',
      renditions: [P720, P1080],
      quality: '480p',
      id: undefined,
    },
    { scenario: 'auto', renditions: LADDER, quality: 'auto', id: undefined },
    {
      scenario: 'renditions with no height',
      renditions: [{ id: '0' }],
      quality: '720p',
      id: undefined,
    },
  ])('picks $id for $scenario', ({ renditions, quality, id }) => {
    expect(findDefaultRendition(renditions, quality)).toBe(id);
  });
});

const track = (kind: string, language: string) => ({ kind, language });
const EN = track('captions', 'en');
const SV = track('subtitles', 'sv-FI');

describe('apps/client/web: findDefaultCaptionTrack', () => {
  it.each([
    {
      scenario: 'the first captions with no language chosen',
      tracks: [SV, EN],
      language: null,
      found: SV,
    },
    { scenario: 'the track in the chosen language', tracks: [SV, EN], language: 'en', found: EN },
    {
      scenario: 'a track of the same language in another region',
      tracks: [EN, SV],
      language: 'sv',
      found: SV,
    },
    { scenario: 'a language tag in another case', tracks: [EN], language: 'EN', found: EN },
    { scenario: 'no track in the chosen language', tracks: [EN], language: 'sv', found: undefined },
    {
      scenario: 'a track that is no captions',
      tracks: [track('metadata', 'en'), track('chapters', 'en')],
      language: null,
      found: undefined,
    },
    { scenario: 'no tracks', tracks: [], language: null, found: undefined },
  ])('finds $scenario', ({ tracks, language, found }) => {
    expect(findDefaultCaptionTrack(tracks, language)).toBe(found);
  });
});
