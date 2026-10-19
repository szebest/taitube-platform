import type { Ref } from '../schema/ref';
import type { Scale } from '../schema/scale';
import type { Theme } from '../schema/theme';
import {
  TOKEN_GROUPS,
  type TokenGroup,
  type TokenSet,
  type TokenValues,
} from '../schema/token-group';

type DtcgType =
  | 'color'
  | 'dimension'
  | 'fontFamily'
  | 'fontWeight'
  | 'shadow'
  | 'boolean'
  | 'number'
  | 'duration'
  | 'cubicBezier'
  | 'string';

type DtcgTree = Readonly<{ [key: string]: unknown }>;

const token = ($type: DtcgType, $value: unknown): DtcgTree => ({ $type, $value });

const eachOf = <V>(record: Readonly<Record<string, V>>, encode: (value: V) => unknown) =>
  Object.fromEntries(Object.entries(record).map(([key, value]) => [key, encode(value)]));

const group = ($type: DtcgType, record: Readonly<Record<string, unknown>>): DtcgTree => ({
  $type,
  ...eachOf(record, ($value) => ({ $value })),
});

const SET_ENCODERS: { readonly [G in TokenGroup]: (values: TokenValues<G>) => DtcgTree } = {
  typography: ({ font, weight, tracking }) => ({
    font: group('fontFamily', font),
    weight: group('fontWeight', weight),
    tracking: group('dimension', tracking),
  }),
  fontSize: (styles) => eachOf(styles, (style) => token('dimension', style)),
  spacing: (roles) => group('dimension', roles),
  sizing: (sizes) => eachOf(sizes, (measures) => group('dimension', measures)),
  radius: (roles) => group('dimension', roles),
  border: (widths) => group('dimension', widths),
  shadow: (steps) => group('shadow', steps),
  ambient: ({
    enabled,
    'opacity-dark': opacityDark,
    'opacity-light': opacityLight,
    blur,
    sample,
  }) => ({
    enabled: token('boolean', enabled),
    'opacity-dark': token('number', opacityDark),
    'opacity-light': token('number', opacityLight),
    blur: token('dimension', blur),
    sample: token('duration', sample),
  }),
  motion: ({ duration, easing }) => ({
    duration: group('duration', duration),
    easing: group('cubicBezier', easing),
  }),
};

type Offer = { readonly [G in TokenGroup]: readonly TokenSet<G>[] };

const encodeSets = <G extends TokenGroup>(name: G, sets: Offer[G]) => {
  const encode: (values: TokenValues<G>) => DtcgTree = SET_ENCODERS[name];
  return [name, Object.fromEntries(sets.map(({ id, values }) => [id, encode(values)]))] as const;
};

const encodeTheme = ({ defaults, color, dataviz }: Theme): DtcgTree => ({
  defaults: eachOf(defaults, ({ id }) => token('string', id)),
  dark: group('color', color.dark),
  light: group('color', color.light),
  oled: group('color', color.oled),
  dataviz: group('color', dataviz),
});

export const toDtcg = ({
  ref,
  scale,
  themes,
  offer,
}: Readonly<{ ref: Ref; scale: Scale; themes: readonly Theme[]; offer: Offer }>): DtcgTree => ({
  ref: eachOf(ref, (ramp) => group('color', ramp)),
  set: Object.fromEntries(TOKEN_GROUPS.map((name) => encodeSets(name, offer[name]))),
  theme: Object.fromEntries(themes.map((theme) => [theme.id, encodeTheme(theme)])),
  scale: {
    space: group('dimension', scale.space),
    z: group('number', scale.z),
    breakpoint: group('dimension', scale.breakpoint),
    layout: group('dimension', scale.layout),
  },
});
