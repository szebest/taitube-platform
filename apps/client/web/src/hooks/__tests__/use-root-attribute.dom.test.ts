import { act, renderHook } from '@testing-library/react';
import { useRootAttribute } from '../use-root-attribute';

afterEach(() => {
  document.documentElement.removeAttribute('data-ambient');
});

describe('apps/client/web: useRootAttribute', () => {
  it.each([
    { value: 'off', read: 'off' },
    { value: undefined, read: undefined },
  ])('reads data-ambient $value as $read', ({ value, read }) => {
    if (value) document.documentElement.dataset.ambient = value;

    expect(renderHook(() => useRootAttribute('ambient')).result.current).toBe(read);
  });

  it('follows the attribute changing', async () => {
    const { result } = renderHook(() => useRootAttribute('ambient'));

    await act(async () => {
      document.documentElement.dataset.ambient = 'off';
    });

    expect(result.current).toBe('off');
  });
});
