import { readFileSync } from 'node:fs';
import { type Rule, transform } from 'lightningcss';

import { THEMES, type Theme } from '../theme/theme-preference';

type Rgb = { r: number; g: number; b: number; alpha: number };

const STYLESHEET = new URL('../design-system.css', import.meta.url);

function themeOf(rule: Extract<Rule, { type: 'style' }>): Theme | 'base' | undefined {
  const themes = rule.value.selectors
    .flat()
    .flatMap((part) =>
      part.type === 'attribute' && part.name === 'data-theme' ? [part.operation?.value] : []
    );
  if (themes.length > 0) return THEMES.find((theme) => themes.includes(theme));
  const onlyRoot = rule.value.selectors
    .flat()
    .every((part) => part.type === 'pseudo-class' && part.kind === 'root');
  return onlyRoot ? 'base' : undefined;
}

/** Every `--vp-*` colour the stylesheet declares, per theme, with the theme-free ones in each. */
function tokensByTheme(): Record<Theme, Map<string, Rgb>> {
  const declared: Record<Theme | 'base', Map<string, Rgb>> = {
    base: new Map(),
    dark: new Map(),
    light: new Map(),
  };
  transform({
    filename: STYLESHEET.pathname,
    code: readFileSync(STYLESHEET),
    errorRecovery: true,
    visitor: {
      Rule: {
        style(rule) {
          const scope = themeOf(rule);
          if (!scope) return;
          for (const declaration of rule.value.declarations.declarations) {
            if (declaration.property !== 'custom') continue;
            const [token] = declaration.value.value;
            if (
              token?.type === 'color' &&
              typeof token.value === 'object' &&
              token.value.type === 'rgb'
            ) {
              declared[scope].set(declaration.value.name, token.value);
            }
          }
        },
      },
    },
  });
  return {
    dark: new Map([...declared.base, ...declared.dark]),
    light: new Map([...declared.base, ...declared.light]),
  };
}

const TOKENS = tokensByTheme();

function token(theme: Theme, name: string): Rgb {
  const value = TOKENS[theme].get(`--vp-${name}`);
  if (!value) throw new Error(`design-system.css declares no --vp-${name} for ${theme}`);
  return value;
}

/** `danger/10` is the `danger` token at 10%, as Tailwind's opacity modifier writes it. */
function layer(theme: Theme, name: string): Rgb {
  const [tokenName = name, percent] = name.split('/');
  const color = token(theme, tokenName);
  return percent === undefined ? color : { ...color, alpha: color.alpha * (Number(percent) / 100) };
}

function over(top: Rgb, bottom: Rgb): Rgb {
  const mix = (front: number, back: number) => front * top.alpha + back * (1 - top.alpha);
  return { r: mix(top.r, bottom.r), g: mix(top.g, bottom.g), b: mix(top.b, bottom.b), alpha: 1 };
}

function luminance({ r, g, b }: Rgb): number {
  const linear = (channel: number) => {
    const value = channel / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(b);
}

function contrast(foreground: Rgb, background: Rgb): number {
  const [lighter, darker] = [luminance(foreground), luminance(background)].sort((a, b) => b - a);
  return ((lighter ?? 0) + 0.05) / ((darker ?? 0) + 0.05);
}

const TEXT = 4.5;
const NON_TEXT = 3;
const SURFACES = ['surface', 'surface-elevated', 'popover'];

/** What is drawn, on which stack of layers (bottom first), and the ratio WCAG 2.2 AA asks of it. */
const PAIRS = [
  ...SURFACES.flatMap((surface) => [
    { use: 'text', color: 'fg', on: [surface], min: TEXT },
    { use: 'secondary text', color: 'fg-muted', on: [surface], min: TEXT },
    {
      use: 'text on a hover or a secondary button',
      color: 'fg',
      on: [surface, 'tint-strong'],
      min: TEXT,
    },
    { use: 'a field error, a destructive item', color: 'danger', on: [surface], min: TEXT },
    ...['danger', 'success', 'warning'].map((intent) => ({
      use: `a ${intent} badge or highlight`,
      color: intent,
      on: [surface, `${intent}/10`],
      min: TEXT,
    })),
    {
      use: 'a control outline, a switch track',
      color: 'border-strong',
      on: [surface],
      min: NON_TEXT,
    },
    { use: 'a checked checkbox or switch', color: 'accent', on: [surface], min: NON_TEXT },
    { use: 'the focus ring', color: 'ring', on: [surface], min: NON_TEXT },
  ]),
  ...['accent', 'accent-hover'].map((fill) => ({
    use: 'a primary button',
    color: 'on-accent',
    on: [fill],
    min: TEXT,
  })),
  ...['danger-solid', 'danger-solid-hover'].map((fill) => ({
    use: 'a destructive button',
    color: 'on-danger',
    on: [fill],
    min: TEXT,
  })),
  { use: 'a tooltip', color: 'surface', on: ['fg'], min: TEXT },
];

const ROWS = THEMES.flatMap((theme) =>
  PAIRS.map((pair) => ({ theme, ...pair, background: pair.on.join(' + ') }))
);

describe('apps/web: design-system tokens', () => {
  it.each(ROWS)(
    '$theme: $use, $color on $background, reaches $min:1',
    ({ theme, color, on, min }) => {
      const background = on
        .map((name) => layer(theme, name))
        .reduce((below, above) => over(above, below));

      expect(contrast(over(layer(theme, color), background), background)).toBeGreaterThanOrEqual(
        min
      );
    }
  );
});
