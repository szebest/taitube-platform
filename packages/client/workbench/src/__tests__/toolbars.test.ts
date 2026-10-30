import {
  appearanceToolbars,
  initialAppearanceGlobals,
  preferenceFromGlobals,
  THEME_DEFAULT,
} from '../toolbars';

const values = (name: string) =>
  (appearanceToolbars[name]?.toolbar?.items ?? []).map((item) =>
    typeof item === 'string' ? item : item.value
  );

describe('@vp/workbench: the appearance toolbars', () => {
  it('offers the registry: its themes, the shown modes, and the theme default plus every offered set', () => {
    expect(values('theme')).toEqual(['sand', 'nocturne']);
    expect(values('mode')).toEqual(['dark', 'light', 'oled']);
    expect(values('radius')).toEqual([THEME_DEFAULT, 'sharp', 'soft', 'round']);
  });

  it.each([
    {
      label: 'the initial globals as the default theme in dark mode with no override',
      globals: initialAppearanceGlobals,
      preference: {
        theme: 'sand',
        mode: 'dark',
        contrast: 'standard',
        accent: null,
        overrides: {},
      },
    },
    {
      label: 'a picked set as an override and the theme default as none',
      globals: { ...initialAppearanceGlobals, theme: 'nocturne', radius: 'soft', mode: 'oled' },
      preference: { theme: 'nocturne', mode: 'oled', overrides: { radius: 'soft' } },
    },
    {
      label: 'a sample accent as the accent override',
      globals: { ...initialAppearanceGlobals, accent: '#FFFF00' },
      preference: { accent: '#FFFF00' },
    },
  ])('reads $label', ({ globals, preference }) => {
    expect(preferenceFromGlobals(globals)).toMatchObject({
      schema: 2,
      accent: null,
      ...preference,
    });
  });
});
