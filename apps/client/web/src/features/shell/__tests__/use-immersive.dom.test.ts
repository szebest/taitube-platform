import { act, renderHook } from '@testing-library/react';

import { useImmersive } from '../use-immersive';

let fullscreen: Element | null = null;

beforeAll(() => {
  Object.defineProperty(document, 'fullscreenElement', {
    configurable: true,
    get: () => fullscreen,
  });
});

afterAll(() => {
  Reflect.deleteProperty(document, 'fullscreenElement');
});

describe('apps/client/web: useImmersive', () => {
  it('follows the page in and out of fullscreen', () => {
    const { result } = renderHook(useImmersive);
    const changeTo = (element: Element | null) =>
      act(() => {
        fullscreen = element;
        document.dispatchEvent(new Event('fullscreenchange'));
      });

    expect(result.current).toBe(false);

    changeTo(document.body);

    expect(result.current).toBe(true);

    changeTo(null);

    expect(result.current).toBe(false);
  });
});
