import { act, renderHook } from '@testing-library/react';
import { TOKEN_GROUPS } from '@vp/design-tokens';
import { readCookie, writeCookie } from '../../cookies/cookie';
import {
  type AppearancePreference,
  DEFAULT_APPEARANCE,
  type StoredAppearance,
  type TokenSetIds,
} from '../preference';
import { AppearanceProvider, useAppearance } from '../provider';
import { stubMediaQueries } from './media-queries';

const stored = (
  preference: Partial<AppearancePreference> = {},
  source: StoredAppearance['source'] = 'appearance'
): StoredAppearance => ({
  preference: { ...DEFAULT_APPEARANCE, ...preference },
  source,
});

const renderAppearance = (from: StoredAppearance = stored(), defaults?: TokenSetIds) =>
  renderHook(() => useAppearance(), {
    wrapper: ({ children }) => (
      <AppearanceProvider stored={from} defaults={defaults}>
        {children}
      </AppearanceProvider>
    ),
  });

const setIds = ({ resolved }: ReturnType<typeof useAppearance>) =>
  Object.fromEntries(TOKEN_GROUPS.map((group) => [group, resolved.sets[group].id]));

const storedCookie = () => JSON.parse(readCookie('vp.appearance') ?? 'null');

describe('@vp/ui: AppearanceProvider', () => {
  beforeEach(() => {
    stubMediaQueries();
  });

  afterEach(() => {
    writeCookie('vp.appearance', '', { maxAge: 0 });
    writeCookie('vp.theme', '', { maxAge: 0 });
  });

  it('applies an override at once, keeps it in the cookie, and carries it across a theme switch', () => {
    const { result } = renderAppearance();

    act(() => result.current.setOverride('spacing', 'airy'));
    act(() => result.current.update({ theme: 'nocturne' }));

    expect(result.current.resolved.theme.id).toBe('nocturne');
    expect(setIds(result.current)).toMatchObject({
      spacing: 'airy',
      radius: 'sharp',
      shadow: 'flat',
    });
    expect(storedCookie()).toMatchObject({ theme: 'nocturne', overrides: { spacing: 'airy' } });
  });

  it('keeps both of two changes made before the view transition swaps the first one in', async () => {
    const deferred: (() => void)[] = [];
    Object.defineProperty(document, 'startViewTransition', {
      configurable: true,
      value: (swap: () => void) => {
        deferred.push(swap);
      },
    });
    onTestFinished(() => {
      Reflect.deleteProperty(document, 'startViewTransition');
    });
    const { result } = renderAppearance();

    act(() => {
      result.current.update({ theme: 'nocturne' });
      result.current.setOverride('spacing', 'airy');
    });
    act(() => {
      for (const swap of deferred) swap();
    });

    expect(result.current.preference).toMatchObject({
      theme: 'nocturne',
      overrides: { spacing: 'airy' },
    });
    expect(storedCookie()).toMatchObject({ theme: 'nocturne', overrides: { spacing: 'airy' } });
  });

  it('builds on what another tab saved since, not on this tab state', () => {
    const { result } = renderAppearance();
    act(() => result.current.update({ theme: 'nocturne' }));

    writeCookie('vp.appearance', JSON.stringify({ ...storedCookie(), mode: 'light' }), {
      maxAge: 60,
    });
    act(() => result.current.setOverride('spacing', 'airy'));

    expect(storedCookie()).toMatchObject({
      theme: 'nocturne',
      mode: 'light',
      overrides: { spacing: 'airy' },
    });
  });

  it.each([
    { label: 'one group', group: 'spacing', left: { radius: 'soft' } },
    { label: 'every group', group: undefined, left: {} },
  ] as const)('resets $label to the theme default', ({ group, left }) => {
    const { result } = renderAppearance(stored({ overrides: { spacing: 'airy', radius: 'soft' } }));

    act(() => result.current.resetOverrides(group));

    expect(setIds(result.current).spacing).toBe('default');
    expect(storedCookie().overrides).toEqual(left);
  });

  it('starts the studio on its compact spacing and small sizing with no override set', () => {
    const { result } = renderAppearance(stored(), { spacing: 'compact', sizing: 'small' });

    expect(setIds(result.current)).toMatchObject({ spacing: 'compact', sizing: 'small' });
  });

  it('rewrites a vp.theme cookie from before schema 2 as vp.appearance, and deletes it', () => {
    writeCookie('vp.theme', 'light', { maxAge: 60 });

    renderAppearance(stored({ mode: 'light' }, 'legacy'));

    expect(readCookie('vp.theme')).toBeUndefined();
    expect(storedCookie()).toMatchObject({ schema: 2, theme: null, mode: 'light' });
  });

  it('shows the OS mode for system and forces reduced motion when the OS asks for it', () => {
    stubMediaQueries({ scheme: 'light', reducedMotion: true });

    const { result } = renderAppearance(stored({ overrides: { motion: 'calm' } }));

    expect(result.current.shownMode).toBe('light');
    expect(setIds(result.current).motion).toBe('reduced');
  });
});
