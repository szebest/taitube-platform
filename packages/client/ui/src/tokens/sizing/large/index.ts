import { defineTokenSet } from '@vp/design-tokens';

export const sizingLarge = defineTokenSet('sizing', 'large', {
  control: {
    sm: '36px',
    md: '44px',
    lg: '52px',
  },
  icon: {
    sm: '18px',
    md: '22px',
    lg: '26px',
  },
  avatar: {
    xs: '20px',
    sm: '28px',
    md: '40px',
    lg: '52px',
    xl: '112px',
  },
  layout: {
    'touch-target': '48px',
    header: '72px',
    'rail-expanded': '272px',
    'rail-collapsed': '84px',
    'card-min': '340px',
    'row-thumb': '196px',
  },
});
