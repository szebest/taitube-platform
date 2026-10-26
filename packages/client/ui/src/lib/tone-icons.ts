import type { ToneOption } from '@vp/design-tokens';
import type { IconId } from '../icons/inventory';

export const TONE_ICONS = {
  neutral: 'info',
  accent: 'info',
  success: 'check',
  warning: 'alert',
  danger: 'alert',
  info: 'info',
} satisfies Record<Exclude<ToneOption, 'live'>, IconId>;
