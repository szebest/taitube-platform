import { defineAppearance, defineRef, defineTheme, defineTokenSet } from '../define';
import {
  color,
  dataviz,
  deepSand,
  defaults,
  offer,
  parsed,
  sand,
  shadowDeep,
  shadowSoft,
} from './fixtures';

describe('define', () => {
  it('keeps a token set group and id as literal types', () => {
    expect(shadowDeep.id satisfies 'deep').toBe('deep');
    expect(shadowDeep).toEqual({ group: 'shadow', id: 'deep', values: parsed.shadow.values });
  });

  it('names a ramp step by a key the ramps hold', () => {
    const { ref } = defineRef({
      sand: { 0: '#FFFCF7', 950: '#14120F' },
      signal: { live: '#D91F3A' },
    });

    expect([ref('sand.950'), ref('signal.live')]).toEqual(['{ref.sand.950}', '{ref.signal.live}']);
    // @ts-expect-error the sand ramp has no 960 step
    ref('sand.960');
  });

  it('refuses a token set missing a key', () => {
    const { card: _card, ...withoutCard } = parsed.radius.values;

    // @ts-expect-error a radius set names every radius role
    defineTokenSet('radius', 'round', withoutCard);
  });

  it('refuses a theme without a default for every group', () => {
    const { shadow: _shadow, ...withoutShadow } = defaults;

    // @ts-expect-error a theme names a default set for every group
    defineTheme({ id: 'sand', name: 'Sand', color, dataviz, defaults: withoutShadow });
  });

  it('refuses a theme missing a role in a mode', () => {
    const { fg: _fg, ...darkWithoutFg } = color.dark;
    const withoutFg = { ...color, dark: darkWithoutFg };

    // @ts-expect-error a theme names every role in every mode
    defineTheme({ id: 'sand', name: 'Sand', color: withoutFg, dataviz, defaults });
  });

  it('builds an appearance whose themes default only to offered sets', () => {
    const appearance = defineAppearance({ themes: [sand], defaultTheme: sand, offer });

    expect(appearance.defaultTheme.id satisfies 'sand').toBe('sand');
  });

  it('refuses a theme defaulting to a set that is not offered', () => {
    // @ts-expect-error deep sand defaults to shadowDeep, which the offer leaves out
    defineAppearance({ themes: [sand, deepSand], defaultTheme: sand, offer });
  });

  it('refuses a default theme that is not one of the themes', () => {
    const offerWithDeep = { ...offer, shadow: [shadowSoft, shadowDeep] } as const;

    // @ts-expect-error deep sand is not among the themes
    defineAppearance({ themes: [sand], defaultTheme: deepSand, offer: offerWithDeep });
  });
});
