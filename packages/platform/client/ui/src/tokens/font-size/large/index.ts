import { defineTokenSet } from '@vp/design-tokens';

export const fontSizeLarge = defineTokenSet('fontSize', 'large', {
  display: {
    size: '54px',
    lineHeight: 1.05,
  },
  headline: {
    size: '36px',
    lineHeight: 1.15,
  },
  'title-lg': {
    size: '25px',
    lineHeight: 1.25,
  },
  title: {
    size: '18px',
    lineHeight: 1.35,
  },
  body: {
    size: '17px',
    lineHeight: 1.55,
  },
  'body-sm': {
    size: '15px',
    lineHeight: 1.5,
  },
  label: {
    size: '16px',
    lineHeight: 1.2,
  },
  caption: {
    size: '14px',
    lineHeight: 1.35,
  },
  overline: {
    size: '12px',
    lineHeight: 1.2,
  },
  editorial: {
    size: '22px',
    lineHeight: 1.4,
  },
  mono: {
    size: '15px',
    lineHeight: 1.3,
  },
});
