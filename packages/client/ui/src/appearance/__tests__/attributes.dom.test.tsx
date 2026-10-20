import { renderHook } from '@testing-library/react';
import { applyAppearance } from '../attributes';
import { DEFAULT_APPEARANCE } from '../preference';
import { AppearanceProvider, useAppearance } from '../provider';
import { stubMediaQueries } from './media-queries';

describe('@vp/ui: applyAppearance', () => {
  it('puts the attributes ThemedDocument renders on an element it does not render', () => {
    stubMediaQueries({ scheme: 'dark' });
    const { result } = renderHook(() => useAppearance(), {
      wrapper: ({ children }) => (
        <AppearanceProvider
          stored={{
            preference: { ...DEFAULT_APPEARANCE, theme: 'nocturne', overrides: { radius: 'soft' } },
            source: 'none',
          }}
        >
          {children}
        </AppearanceProvider>
      ),
    });
    const element = document.createElement('div');

    applyAppearance(element, result.current);

    expect(element.dataset).toMatchObject({
      theme: 'nocturne',
      mode: 'dark',
      contrast: 'standard',
      fontSize: 'default',
      radius: 'soft',
      shadow: 'flat',
    });
  });
});
