import { renderHook } from '@testing-library/react';
import { Direction } from 'radix-ui';
import type { PropsWithChildren } from 'react';
import type { Side } from '../../types';
import { usePhysicalSide } from '../physical-side';

const renderSide = (side: Side, dir: 'ltr' | 'rtl') =>
  renderHook(() => usePhysicalSide(side), {
    wrapper: ({ children }: PropsWithChildren) => (
      <Direction.Provider dir={dir}>{children}</Direction.Provider>
    ),
  }).result.current;

describe('@vp/ui: usePhysicalSide', () => {
  it.each([
    { side: 'block-start', dir: 'ltr', physical: 'top' },
    { side: 'block-end', dir: 'rtl', physical: 'bottom' },
    { side: 'inline-start', dir: 'ltr', physical: 'left' },
    { side: 'inline-start', dir: 'rtl', physical: 'right' },
    { side: 'inline-end', dir: 'ltr', physical: 'right' },
    { side: 'inline-end', dir: 'rtl', physical: 'left' },
  ] as const)('places $side on the $physical edge when reading $dir', ({ side, dir, physical }) => {
    expect(renderSide(side, dir)).toBe(physical);
  });
});
