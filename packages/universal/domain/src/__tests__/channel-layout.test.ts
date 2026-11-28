import { CHANNEL_LAYOUT_VERSION, standardChannelLayout, migrateLayout } from '../channel-layout';

describe('@vp/domain: migrateLayout', () => {
  it('returns a current document as it is', () => {
    const layout = standardChannelLayout();

    expect(migrateLayout(layout)).toBe(layout);
  });

  it.each([
    { scenario: 'a value that is not an object', raw: 'layout' },
    { scenario: 'an array', raw: [] },
    { scenario: 'an object without a version', raw: { tabs: [] } },
    {
      scenario: 'a version newer than this build',
      raw: { schemaVersion: CHANNEL_LAYOUT_VERSION + 1 },
    },
    { scenario: 'an old version without a migration', raw: { schemaVersion: 0 } },
  ])('answers null for $scenario', ({ raw }) => {
    expect(migrateLayout(raw)).toBeNull();
  });

  it('runs each step from the stored version up to the current one', () => {
    const migrated = migrateLayout(
      { schemaVersion: 0, old: true },
      { 0: ({ old, ...rest }) => ({ ...rest, schemaVersion: 1, upgraded: old }) }
    );

    expect(migrated).toEqual({ schemaVersion: 1, upgraded: true });
  });

  it('refuses a step that does not move the version forward', () => {
    expect(migrateLayout({ schemaVersion: 0 }, { 0: (document) => document })).toBeNull();
  });
});

describe('@vp/domain: standardChannelLayout', () => {
  it('keeps Home and About and lands every viewer on Home', () => {
    const layout = standardChannelLayout();

    expect(layout.tabs.map(({ kind }) => kind)).toEqual([
      'home',
      'videos',
      'shorts',
      'posts',
      'playlists',
      'about',
    ]);
    expect(layout.landing).toEqual({ visitor: 'home', subscriber: 'home' });
  });
});
