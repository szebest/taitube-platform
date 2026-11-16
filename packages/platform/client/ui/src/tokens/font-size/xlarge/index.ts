import { defineTokenSet } from '@vp/design-tokens';

export const fontSizeXlarge = defineTokenSet('fontSize', 'xlarge', {
  display: {
    size: '60px',
    lineHeight: 1.05,
  },
  headline: {
    size: '40px',
    lineHeight: 1.15,
  },
  'title-lg': {
    size: '28px',
    lineHeight: 1.25,
  },
  title: {
    size: '20px',
    lineHeight: 1.35,
  },
  body: {
    size: '19px',
    lineHeight: 1.55,
  },
  'body-sm': {
    size: '16px',
    lineHeight: 1.5,
  },
  label: {
    size: '18px',
    lineHeight: 1.2,
  },
  caption: {
    size: '15px',
    lineHeight: 1.35,
  },
  overline: {
    size: '14px',
    lineHeight: 1.2,
  },
  editorial: {
    size: '25px',
    lineHeight: 1.4,
  },
  mono: {
    size: '16px',
    lineHeight: 1.3,
  },
});
