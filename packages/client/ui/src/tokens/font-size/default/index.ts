import { defineTokenSet } from '@vp/design-tokens';

export const fontSizeDefault = defineTokenSet('fontSize', 'default', {
  display: {
    size: '48px',
    lineHeight: 1.05,
  },
  headline: {
    size: '32px',
    lineHeight: 1.15,
  },
  'title-lg': {
    size: '22px',
    lineHeight: 1.25,
  },
  title: {
    size: '16px',
    lineHeight: 1.35,
  },
  body: {
    size: '15px',
    lineHeight: 1.55,
  },
  'body-sm': {
    size: '13px',
    lineHeight: 1.5,
  },
  label: {
    size: '14px',
    lineHeight: 1.2,
  },
  caption: {
    size: '12px',
    lineHeight: 1.35,
  },
  overline: {
    size: '11px',
    lineHeight: 1.2,
  },
  editorial: {
    size: '20px',
    lineHeight: 1.4,
  },
  mono: {
    size: '13px',
    lineHeight: 1.3,
  },
});
