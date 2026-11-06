import { act, renderHook } from '@testing-library/react';
import { useInstallPrompt } from '../use-install-prompt';

function offerInstall() {
  const prompt = vi.fn().mockResolvedValue(undefined);
  const event = Object.assign(new Event('beforeinstallprompt', { cancelable: true }), { prompt });
  act(() => {
    window.dispatchEvent(event);
  });
  return { event, prompt };
}

describe('apps/client/web: useInstallPrompt', () => {
  afterEach(() => {
    window.localStorage.clear();
  });

  it('offers nothing before the browser does', () => {
    const { result } = renderHook(() => useInstallPrompt());

    expect(result.current.available).toBe(false);
  });

  it('ignores a beforeinstallprompt it cannot prompt with', () => {
    const { result } = renderHook(() => useInstallPrompt());

    act(() => {
      window.dispatchEvent(new Event('beforeinstallprompt'));
    });

    expect(result.current.available).toBe(false);
  });

  it('holds back the browser banner, offers the install and spends the event once asked', () => {
    const { result } = renderHook(() => useInstallPrompt());
    const { event, prompt } = offerInstall();

    expect(event.defaultPrevented).toBe(true);
    expect(result.current.available).toBe(true);

    act(() => result.current.install());

    expect(prompt).toHaveBeenCalledOnce();
    expect(result.current.available).toBe(false);
  });

  it('stops offering once the app is installed', () => {
    const { result } = renderHook(() => useInstallPrompt());
    offerInstall();

    act(() => {
      window.dispatchEvent(new Event('appinstalled'));
    });

    expect(result.current.available).toBe(false);
  });

  it('stays dismissed across visits', () => {
    const first = renderHook(() => useInstallPrompt());
    offerInstall();
    act(() => first.result.current.dismiss());
    first.unmount();

    const second = renderHook(() => useInstallPrompt());
    offerInstall();

    expect(second.result.current.available).toBe(false);
  });
});
