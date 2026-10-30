import { act, renderHook } from '@testing-library/react';
import type { TokenGroup } from '@vp/design-tokens';
import { AppearanceProvider, DEFAULT_APPEARANCE } from '@vp/ui';

import { useTokenOverride } from '../use-token-override';

const renderOverride = (group: TokenGroup, overrides: Record<string, string> = {}) =>
  renderHook(() => useTokenOverride(group), {
    wrapper: ({ children }) => (
      <AppearanceProvider
        stored={{ preference: { ...DEFAULT_APPEARANCE, overrides }, source: 'none' }}
      >
        {children}
      </AppearanceProvider>
    ),
  });

describe('apps/client/web: useTokenOverride', () => {
  it('offers the registry sets and the theme default, and holds no override until one is chosen', () => {
    const { result } = renderOverride('spacing');

    expect(result.current.sets.map(({ id }) => id)).toEqual(['compact', 'default', 'airy']);
    expect(result.current.defaultSet.id).toBe('default');
    expect(result.current.override).toBeUndefined();
  });

  it('chooses a set at once, and returns to the default on reset', () => {
    const { result } = renderOverride('spacing');

    act(() => result.current.choose('airy'));
    expect(result.current.override).toBe('airy');
    expect(result.current.shown.id).toBe('airy');

    act(() => result.current.reset());
    expect(result.current.override).toBeUndefined();
    expect(result.current.shown.id).toBe('default');
  });

  it('ignores a stored override the registry does not offer', () => {
    const { result } = renderOverride('radius', { radius: 'pill' });

    expect(result.current.override).toBeUndefined();
    expect(result.current.shown.id).toBe('round');
  });
});
