import { act, renderHook } from '@testing-library/react';
import { PREFERS_LIGHT, useMediaQuery } from '../media';
import { stubMediaQueries } from './media-queries';

describe('@vp/ui: useMediaQuery', () => {
  it('answers the query and follows the OS when it changes', () => {
    const { change } = stubMediaQueries({ scheme: 'dark' });
    const { result } = renderHook(() => useMediaQuery(PREFERS_LIGHT));
    expect(result.current).toBe(false);

    act(() => change({ scheme: 'light' }));

    expect(result.current).toBe(true);
  });
});
