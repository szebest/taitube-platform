import { act, renderHook } from '@testing-library/react';

import { useReducedMotion } from '../use-reduced-motion';

afterEach(() => {
  delete document.documentElement.dataset.motion;
});

describe('apps/client/web: useReducedMotion', () => {
  it.each([
    { motion: 'reduced', reduced: true },
    { motion: 'standard', reduced: false },
    { motion: undefined, reduced: false },
  ])('reads data-motion $motion as $reduced', ({ motion, reduced }) => {
    if (motion) document.documentElement.dataset.motion = motion;

    expect(renderHook(() => useReducedMotion()).result.current).toBe(reduced);
  });

  it('follows the viewer switching the motion set', async () => {
    const { result } = renderHook(() => useReducedMotion());

    await act(async () => {
      document.documentElement.dataset.motion = 'reduced';
    });

    expect(result.current).toBe(true);
  });
});
