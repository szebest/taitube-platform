import { type AppearancePreference, DEFAULT_APPEARANCE } from '@vp/ui';
import { appearanceChange } from '../appearance-change';

const appearance = (changes: Partial<AppearancePreference> = {}): AppearancePreference => ({
  ...DEFAULT_APPEARANCE,
  ...changes,
});

describe('appearanceChange', () => {
  it.each([
    {
      label: 'an axis',
      from: appearance(),
      to: appearance({ mode: 'oled' }),
      expected: { appearance: { mode: 'oled' } },
    },
    {
      label: 'an axis set back to the theme default',
      from: appearance({ accent: '#3d6595' }),
      to: appearance({ accent: null }),
      expected: { appearance: { accent: null } },
    },
    {
      label: 'an override set',
      from: appearance(),
      to: appearance({ overrides: { spacing: 'airy' } }),
      expected: { appearance: { overrides: { spacing: 'airy' } } },
    },
    {
      label: 'an override reset',
      from: appearance({ overrides: { spacing: 'airy', radius: 'sharp' } }),
      to: appearance({ overrides: { radius: 'sharp', spacing: undefined } }),
      expected: { appearance: { overrides: { spacing: null } } },
    },
    {
      label: 'an axis and an override together',
      from: appearance(),
      to: appearance({ theme: 'nocturne', overrides: { radius: 'sharp' } }),
      expected: { appearance: { theme: 'nocturne', overrides: { radius: 'sharp' } } },
    },
    {
      label: 'a built theme, its colours with the theme id',
      from: appearance(),
      to: appearance({ theme: 'custom', customGround: '#14110d', customAccent: '#3366cc' }),
      expected: {
        appearance: { theme: 'custom', customGround: '#14110d', customAccent: '#3366cc' },
      },
    },
    {
      label: 'nothing for the same preference',
      from: appearance(),
      to: appearance(),
      expected: undefined,
    },
  ])('sends $label', ({ from, to, expected }) => {
    expect(appearanceChange(from, to)).toEqual(expected);
  });
});
