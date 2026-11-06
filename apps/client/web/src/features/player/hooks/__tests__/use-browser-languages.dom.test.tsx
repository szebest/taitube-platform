import { act, renderHook } from '@testing-library/react';
import { useBrowserLanguages } from '../use-browser-languages';

const renderLanguages = () => renderHook(() => useBrowserLanguages());

describe('apps/client/web: useBrowserLanguages', () => {
  it("follows the browser's languages as they change, from a browser that hands back a new list on every read", () => {
    const languages = vi
      .spyOn(navigator, 'languages', 'get')
      .mockImplementation(() => ['sv-FI', 'en']);
    const { result } = renderLanguages();
    expect(result.current).toEqual(['sv-FI', 'en']);

    languages.mockImplementation(() => ['pl']);
    act(() => {
      window.dispatchEvent(new Event('languagechange'));
    });

    expect(result.current).toEqual(['pl']);
  });
});
