import { act, renderHook } from '@testing-library/react';
import { useOnlineStatus } from '../use-online-status';

function connection(online: boolean) {
  vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(online);
  act(() => {
    window.dispatchEvent(new Event(online ? 'online' : 'offline'));
  });
}

describe('apps/client/web: useOnlineStatus', () => {
  it('starts from navigator.onLine', () => {
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);

    const { result } = renderHook(() => useOnlineStatus());

    expect(result.current).toBe(false);
  });

  it('follows the online and offline events', () => {
    const { result } = renderHook(() => useOnlineStatus());

    connection(false);

    expect(result.current).toBe(false);

    connection(true);

    expect(result.current).toBe(true);
  });
});
