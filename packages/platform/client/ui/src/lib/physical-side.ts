import { Direction } from 'radix-ui';
import type { Side } from '../types';

type PhysicalSide = 'top' | 'right' | 'bottom' | 'left';

const PHYSICAL_SIDES = {
  ltr: {
    'block-start': 'top',
    'block-end': 'bottom',
    'inline-start': 'left',
    'inline-end': 'right',
  },
  rtl: {
    'block-start': 'top',
    'block-end': 'bottom',
    'inline-start': 'right',
    'inline-end': 'left',
  },
} as const satisfies Record<'ltr' | 'rtl', Record<Side, PhysicalSide>>;

/** The edge Radix places a floating part on, for a logical `side` in the reading direction. */
export function usePhysicalSide(side: Side): PhysicalSide {
  return PHYSICAL_SIDES[Direction.useDirection()][side];
}
