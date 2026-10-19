import { defineTokenSet } from '@vp/design-tokens';

export const typographyFigtree = defineTokenSet('typography', 'figtree', {
  font: {
    sans: ['Figtree Variable', 'ui-sans-serif', 'system-ui', 'sans-serif'],
    editorial: ['Newsreader Variable', 'ui-serif', 'Georgia', 'serif'],
    mono: ['Geist Mono Variable', 'ui-monospace', 'SFMono-Regular', 'monospace'],
  },
  weight: {
    display: 800,
    headline: 750,
    'title-lg': 750,
    title: 650,
    body: 400,
    'body-sm': 400,
    label: 650,
    caption: 500,
    overline: 750,
    editorial: 420,
    mono: 500,
  },
  tracking: {
    display: '-0.035em',
    headline: '-0.025em',
    'title-lg': '-0.015em',
    title: '-0.005em',
    body: '0em',
    'body-sm': '0em',
    label: '0em',
    caption: '0.005em',
    overline: '0.1em',
    editorial: '-0.005em',
    mono: '0em',
  },
});
