import { DEFAULT_PREFERENCES } from '@vp/domain/settings';
import { getPreferences, updatePreferences } from '../preferences';

const NOTHING_SAVED = {
  appearance: null,
  playback: null,
  privacy: null,
  notifications: null,
  version: 0,
  updatedAt: null,
};

const parsePatch = (body: object) => updatePreferences.body.safeParse({ version: 0, ...body });

describe('packages/api-contracts: preferences', () => {
  it('reads and writes one document under /v1/me/preferences', () => {
    expect(getPreferences).toMatchObject({ method: 'GET', path: '/v1/me/preferences' });
    expect(updatePreferences).toMatchObject({ method: 'PATCH', path: '/v1/me/preferences' });
  });

  it.each([
    { scenario: 'nothing saved', document: NOTHING_SAVED },
    {
      scenario: 'every section at its defaults',
      document: { ...DEFAULT_PREFERENCES, version: 1, updatedAt: '2026-10-19T00:00:00.000Z' },
    },
  ])('answers a document with $scenario', ({ document }) => {
    expect(getPreferences.result.parse(document)).toEqual(document);
  });

  it('takes a partial patch with nulls, and stores the accent lowercase', () => {
    const patch = {
      version: 2,
      appearance: { accent: '#A1B2C3', overrides: { fontSize: 'large', spacing: null } },
      playback: { speed: 1.25, captionsLanguage: null },
      privacy: null,
    };

    expect(updatePreferences.body.parse(patch)).toEqual({
      ...patch,
      appearance: { ...patch.appearance, accent: '#a1b2c3' },
    });
  });

  it.each([
    { scenario: 'no version', body: { version: undefined } },
    { scenario: 'a mode outside the vocabulary', body: { appearance: { mode: 'dim' } } },
    { scenario: 'a quality the ladder lacks', body: { playback: { quality: '4k' } } },
    { scenario: 'a speed between steps', body: { playback: { speed: 1.1 } } },
    {
      scenario: 'a visibility outside the vocabulary',
      body: { privacy: { playlistVisibility: 'friends' } },
    },
    {
      scenario: 'a flag that is not a boolean',
      body: { notifications: { processingFinished: 'no' } },
    },
  ])('refuses a patch with $scenario', ({ body }) => {
    expect(parsePatch(body).success).toBe(false);
  });
});
