import { defineTokenSet } from '@vp/design-tokens';

export const sizingSmall = defineTokenSet('sizing', 'small', {
  control: {
    sm: '28px',
    md: '36px',
    lg: '44px',
  },
  icon: {
    sm: '14px',
    md: '18px',
    lg: '22px',
  },
  avatar: {
    xs: '16px',
    sm: '24px',
    md: '32px',
    lg: '40px',
    xl: '80px',
  },
  layout: {
    'touch-target': '44px',
    header: '56px',
    'rail-expanded': '232px',
    'rail-collapsed': '72px',
    'card-min': '232px',
    'row-thumb': '140px',
  },
});
