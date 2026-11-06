import { findDefaultRendition, pickCaptionTrack } from '../playback-defaults';
import type { PlayerCaptionTrack } from '../player-port';

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

const track = (
  id: string,
  language: string | null,
  kind: PlayerCaptionTrack['kind'] = 'uploaded'
): PlayerCaptionTrack => ({ id, language, kind, src: `https://cdn.test/${id}.vtt` });
const EN = track('en', 'en');
const SV = track('sv', 'sv-FI');
const AUTO_DE = track('de', 'de', 'auto');
const UNDETECTED = track('auto', null, 'auto');

describe('apps/client/web: pickCaptionTrack', () => {
  it.each([
    {
      scenario: 'the chosen language over the browser and the detected one',
      tracks: [AUTO_DE, SV, EN],
      chosen: 'en',
      browser: ['sv'],
      picked: EN,
    },
    {
      scenario: 'the chosen language in another region and case',
      tracks: [EN, SV],
      chosen: 'SV',
      browser: [],
      picked: SV,
    },
    {
      scenario: 'the first browser language a track has, with the chosen one missing',
      tracks: [AUTO_DE, EN, SV],
      chosen: 'fi',
      browser: ['fi-FI', 'sv-SE', 'en'],
      picked: SV,
    },
    {
      scenario: 'the detected language with no language match',
      tracks: [EN, AUTO_DE],
      chosen: null,
      browser: ['fi'],
      picked: AUTO_DE,
    },
    {
      scenario: 'a generated track whose language is not detected yet',
      tracks: [EN, UNDETECTED],
      chosen: null,
      browser: [],
      picked: UNDETECTED,
    },
    {
      scenario: 'the first track with no match and nothing generated',
      tracks: [SV, EN],
      chosen: 'fi',
      browser: [],
      picked: SV,
    },
    { scenario: 'nothing with no tracks', tracks: [], chosen: 'en', browser: ['en'], picked: undefined },
  ])('picks $scenario', ({ tracks, chosen, browser, picked }) => {
    expect(pickCaptionTrack(tracks, chosen, browser)).toBe(picked);
  });
});
