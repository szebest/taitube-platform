import {
  COOKIE_MIGRATIONS,
  currentVersion,
  migrate,
  type MigrationStep,
  STORAGE_MIGRATIONS,
} from '../migrations';

const ADD_NOTE: MigrationStep = (stored) => ({ ...stored, note: 'two' });
const RENAME: MigrationStep = ({ note, ...rest }) => ({ ...rest, remark: note });

describe('apps/client/web: preference migrations', () => {
  it.each([
    { label: 'the cookie', steps: COOKIE_MIGRATIONS, version: 2 },
    { label: 'localStorage', steps: STORAGE_MIGRATIONS, version: 1 },
  ])('puts $label at version $version', ({ steps, version }) => {
    expect(currentVersion(steps)).toBe(version);
  });

  it.each([
    {
      label: 'a version 1 cookie: the playback is handed over, the locale kept',
      stored: { schema: 1, playback: { speed: 1.5 }, locale: 'sv-FI' },
      expected: { schema: 2, locale: 'sv-FI', legacyPlayback: { speed: 1.5 } },
    },
    {
      label: 'a version 2 cookie: as it is',
      stored: { schema: 2, locale: 'sv-FI' },
      expected: { schema: 2, locale: 'sv-FI' },
    },
  ])('moves $label', ({ stored, expected }) => {
    expect(migrate(stored, COOKIE_MIGRATIONS)).toEqual({ stored: expected, newer: false });
  });

  it.each([
    { label: 'nothing stored', raw: undefined },
    { label: 'text', raw: 'nope' },
    { label: 'a list', raw: [] },
    { label: 'no version', raw: { locale: 'sv-FI' } },
  ])('reads $label as version 1', ({ raw }) => {
    expect(migrate(raw, COOKIE_MIGRATIONS).stored).toMatchObject({ schema: 2 });
  });

  it('runs every step in order from the stored version', () => {
    expect(migrate({ schema: 1 }, [ADD_NOTE, RENAME]).stored).toEqual({
      schema: 3,
      remark: 'two',
    });
    expect(migrate({ schema: 2, note: 'kept' }, [ADD_NOTE, RENAME]).stored).toEqual({
      schema: 3,
      remark: 'kept',
    });
  });

  it('leaves data from a newer version as it is, flagged, for the fields this code knows', () => {
    const stored = { schema: 9, locale: 'sv-FI', ahead: true };

    expect(migrate(stored, COOKIE_MIGRATIONS)).toEqual({ stored, newer: true });
  });
});
