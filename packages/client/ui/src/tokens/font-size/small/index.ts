import { defineTokenSet } from '@vp/design-tokens';

export const fontSizeSmall = defineTokenSet('fontSize', 'small', {
  display: {
    size: '43px',
    lineHeight: 1.05,
  },
  headline: {
    size: '29px',
    lineHeight: 1.15,
  },
  'title-lg': {
    size: '20px',
    lineHeight: 1.25,
  },
  title: {
    size: '14px',
    lineHeight: 1.35,
  },
  body: {
    size: '14px',
    lineHeight: 1.55,
  },
  'body-sm': {
    size: '12px',
    lineHeight: 1.5,
  },
  label: {
    size: '13px',
    lineHeight: 1.2,
  },
  caption: {
    size: '11px',
    lineHeight: 1.35,
  },
  overline: {
    size: '11px',
    lineHeight: 1.2,
  },
  editorial: {
    size: '18px',
    lineHeight: 1.4,
  },
  mono: {
    size: '12px',
    lineHeight: 1.3,
  },
});
