import { appearance } from '@vp/ui/appearance/registry';

import { SETTING_ROWS, SETTINGS_SECTION_IDS, SETTINGS_SECTIONS } from '../settings-index';

describe('the settings index', () => {
  it('has a row for every token group the registry offers, on the advanced page', () => {
    const advanced = SETTING_ROWS.filter(({ section }) => section === 'advanced').map(
      ({ id }) => id
    );

    expect(advanced.sort()).toEqual(Object.keys(appearance.offer).sort());
  });

  it('gives every row a page, and a row an id of its own', () => {
    const ids = SETTING_ROWS.map(({ id }) => id);

    expect(new Set(ids).size).toBe(ids.length);
    expect(SETTING_ROWS.every(({ section }) => SETTINGS_SECTION_IDS.includes(section))).toBe(true);
  });

  it('lists every section but the pages that sit under another, as a section of the navigation', () => {
    expect(SETTINGS_SECTION_IDS.filter((id) => SETTINGS_SECTIONS[id].inNav)).toEqual([
      'appearance',
      'accessibility',
      'playback',
      'privacy',
      'notifications',
      'language',
    ]);
  });
});
