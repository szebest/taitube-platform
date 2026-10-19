import { defineTheme, defineTokenSet } from '../../define';
import type { RoleColors } from '../../schema/roles';

export const lines = (...written: string[]) => `${written.join('\n')}\n`;

const layer = (offsetY: string, blur: string, color: string) => ({
  color,
  offsetX: '0px',
  offsetY,
  blur,
  spread: '0px',
});

const weights = {
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
};

const step = (size: string, lineHeight: number) => ({ size, lineHeight });

export const fixtureSets = {
  typography: defineTokenSet('typography', 'plain', {
    font: { sans: ['Plain Sans', 'sans-serif'], editorial: ['serif'], mono: ['monospace'] },
    weight: weights,
    tracking: {
      display: '-0.02em',
      headline: '-0.01em',
      'title-lg': '0em',
      title: '0em',
      body: '0em',
      'body-sm': '0em',
      label: '0em',
      caption: '0em',
      overline: '0.1em',
      editorial: '0em',
      mono: '0em',
    },
  }),
  fontSize: defineTokenSet('fontSize', 'tiny', {
    display: step('40px', 1.1),
    headline: step('30px', 1.2),
    'title-lg': step('20px', 1.25),
    title: step('16px', 1.3),
    body: step('14px', 1.5),
    'body-sm': step('12px', 1.5),
    label: step('13px', 1.2),
    caption: step('11px', 1.3),
    overline: step('11px', 1.2),
    editorial: step('18px', 1.4),
    mono: step('12px', 1.3),
  }),
  spacing: defineTokenSet('spacing', 'snug', {
    'inset-control': '10px',
    'inset-card': '14px',
    'gap-inline': '6px',
    'gap-stack': '10px',
    'gap-grid-x': '12px',
    'gap-grid-y': '20px',
    'gap-shelf': '10px',
    section: '24px',
    'gutter-compact': '10px',
    'gutter-medium': '14px',
    'gutter-expanded': '20px',
  }),
  sizing: defineTokenSet('sizing', 'snug', {
    control: { sm: '24px', md: '32px', lg: '40px' },
    icon: { sm: '12px', md: '16px', lg: '20px' },
    avatar: { xs: '16px', sm: '20px', md: '28px', lg: '36px', xl: '72px' },
    layout: {
      'touch-target': '44px',
      header: '52px',
      'rail-expanded': '220px',
      'rail-collapsed': '68px',
      'card-min': '220px',
      'row-thumb': '120px',
    },
  }),
  radius: defineTokenSet('radius', 'square', {
    xs: '0px',
    sm: '1px',
    thumb: '2px',
    card: '3px',
    sheet: '4px',
    control: '5px',
    chip: '6px',
  }),
  border: defineTokenSet('border', 'thin', {
    divider: '1px',
    control: '1px',
    focus: '2px',
    'focus-offset': '3px',
  }),
  shadow: defineTokenSet('shadow', 'drop', {
    'dark-1': [layer('1px', '2px', '#00000066')],
    'dark-2': [layer('2px', '4px', '#00000066'), layer('8px', '16px', '#00000033')],
    'dark-3': [layer('4px', '8px', '#00000080')],
    'light-1': [layer('1px', '2px', '#0000001A')],
    'light-2': [layer('2px', '4px', '#0000001A')],
    'light-3': [layer('4px', '8px', '#00000026')],
  }),
  ambient: defineTokenSet('ambient', 'glow', {
    enabled: true,
    'opacity-dark': 0.5,
    'opacity-light': 0.2,
    blur: '60px',
    sample: '750ms',
  }),
  motion: defineTokenSet('motion', 'brisk', {
    duration: { instant: '50ms', fast: '100ms', base: '200ms', slow: '300ms', cinematic: '500ms' },
    easing: {
      standard: [0.2, 0, 0, 1],
      enter: [0, 0, 0.2, 1],
      exit: [0.4, 0, 1, 1],
      settle: [0.2, 0.8, 0.2, 1],
    },
  }),
};

const dark: RoleColors = {
  bg: '#101010',
  surface: '#181818',
  raised: '#202020',
  border: '#303030',
  'border-strong': '#707070',
  fg: '#F0F0F0',
  'fg-muted': '#B0B0B0',
  'fg-subtle': '#808080',
  tint: '#FFFFFF12',
  'tint-strong': '#FFFFFF1F',
  accent: '#C08040',
  'accent-hover': '#D09050',
  'on-accent': '#101010',
  'accent-ink': '#D09050',
  'accent-soft': '#C0804029',
  'focus-ring': '#D09050',
  live: '#D02030',
  'on-live': '#FFFFFF',
  danger: '#C03030',
  'danger-ink': '#F09090',
  'success-ink': '#90C090',
  'warning-ink': '#F0A070',
  'info-ink': '#90B0E0',
  scrim: '#000000B8',
  media: '#000000',
};

export const fixtureTheme = defineTheme({
  id: 'dusk',
  name: 'Dusk',
  color: {
    dark,
    light: { ...dark, bg: '#F8F8F8', surface: '#FFFFFF', fg: '#181818' },
    oled: { bg: '#000000', surface: '#080808' },
  },
  dataviz: {
    'categorical-dark': ['#C08040', '#80B090', '#80A0D0', '#D08060', '#B090D0', '#60B0A0'],
    'categorical-light': ['#806030', '#407050', '#406090', '#A05030', '#705090', '#207070'],
    sequential: ['#F0E0C0', '#E0C080', '#C08040', '#806030', '#403020'],
    diverging: ['#A05030', '#D08060', '#C0C0C0', '#60B0A0', '#207070'],
  },
  defaults: fixtureSets,
});
