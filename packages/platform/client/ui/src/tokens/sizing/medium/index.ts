import { defineTokenSet } from '@vp/design-tokens';

export const sizingMedium = defineTokenSet('sizing', 'medium', {
  control: {
    sm: '32px',
    md: '40px',
    lg: '48px',
  },
  icon: {
    sm: '16px',
    md: '20px',
    lg: '24px',
  },
  avatar: {
    xs: '16px',
    sm: '24px',
    md: '36px',
    lg: '44px',
    xl: '96px',
  },
  layout: {
    'touch-target': '44px',
    header: '64px',
    'rail-expanded': '248px',
    'rail-collapsed': '76px',
    'card-min': '300px',
    'row-thumb': '168px',
  },
});
