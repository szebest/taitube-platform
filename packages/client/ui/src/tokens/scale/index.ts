import type { Scale } from '@vp/design-tokens';

export const scale = {
  space: {
    0: '0px',
    1: '4px',
    2: '8px',
    3: '12px',
    4: '16px',
    5: '20px',
    6: '24px',
    8: '32px',
    10: '40px',
    12: '48px',
    16: '64px',
    20: '80px',
    24: '96px',
  },
  z: {
    base: 0,
    sticky: 20,
    rail: 30,
    overlay: 40,
    modal: 50,
    popover: 60,
    toast: 70,
    tooltip: 80,
  },
  breakpoint: {
    medium: '600px',
    expanded: '1024px',
    large: '1440px',
    xlarge: '1920px',
  },
  layout: {
    'content-max': '2200px',
    'reading-max': '68ch',
  },
} as const satisfies Scale;
