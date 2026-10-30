import { act, renderHook } from '@testing-library/react';
import { DEFAULT_APPEARANCE } from '../preference';
import { AppearanceProvider, useAppearance } from '../provider';
import { useDensity } from '../use-density';
import { stubMediaQueries } from './media-queries';

const renderDensity = (defaults?: { spacing: 'compact'; sizing: 'small' }) =>
  renderHook(() => ({ ...useDensity(), appearance: useAppearance() }), {
    wrapper: ({ children }) => (
      <AppearanceProvider
        stored={{ preference: DEFAULT_APPEARANCE, source: 'none' }}
        defaults={defaults}
      >
        {children}
      </AppearanceProvider>
    ),
  });

const shownSets = ({ appearance }: ReturnType<typeof renderDensity>['result']['current']) =>
  `${appearance.resolved.sets.spacing.id} ${appearance.resolved.sets.sizing.id}`;

describe('@vp/ui: useDensity', () => {
  beforeEach(() => {
    stubMediaQueries();
  });

  it('writes spacing and sizing together, and clears both on comfortable', () => {
    const { result } = renderDensity();
    expect(result.current.density).toBe('comfortable');

    act(() => result.current.setDensity('compact'));
    expect(result.current.density).toBe('compact');
    expect(shownSets(result.current)).toBe('compact small');
    expect(result.current.appearance.preference.overrides).toEqual({
      spacing: 'compact',
      sizing: 'small',
    });

    act(() => result.current.setDensity('comfortable'));
    expect(shownSets(result.current)).toBe('default medium');
    expect(result.current.appearance.preference.overrides).toEqual({
      spacing: undefined,
      sizing: undefined,
    });
  });

  it("names the theme's own sets on comfortable where the app starts compact", () => {
    const { result } = renderDensity({ spacing: 'compact', sizing: 'small' });
    expect(result.current.density).toBe('compact');

    act(() => result.current.setDensity('comfortable'));

    expect(shownSets(result.current)).toBe('default medium');
  });
});
