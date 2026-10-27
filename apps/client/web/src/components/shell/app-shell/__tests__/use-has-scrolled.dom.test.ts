import { act, fireEvent, renderHook } from '@testing-library/react';

import { useHasScrolled } from '../use-has-scrolled';

describe('apps/client/web: useHasScrolled', () => {
  afterEach(() => {
    window.scrollY = 0;
  });

  it.each([
    { scrollY: 0, scrolled: false },
    { scrollY: 120, scrolled: true },
  ])('reads $scrolled at a scroll position of $scrollY', ({ scrollY, scrolled }) => {
    const { result } = renderHook(() => useHasScrolled());

    act(() => {
      window.scrollY = scrollY;
      fireEvent.scroll(window);
    });

    expect(result.current).toBe(scrolled);
  });

  it('starts from the position the page is already at', () => {
    window.scrollY = 40;

    const { result } = renderHook(() => useHasScrolled());

    expect(result.current).toBe(true);
  });
});
