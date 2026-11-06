import { renderHook } from '@testing-library/react';
import { useOrigin } from '../use-origin';

describe('apps/client/studio: useOrigin', () => {
  it("is the browser window's origin", () => {
    const { result } = renderHook(() => useOrigin());

    expect(result.current).toBe(window.location.origin);
  });
});
