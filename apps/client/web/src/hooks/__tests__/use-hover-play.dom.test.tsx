import { renderHook } from '@testing-library/react';
import { writeCookie } from '@vp/ui';
import type { ComponentType, PropsWithChildren } from 'react';
import { AppProviders } from '#app/__tests__/providers';
import { saveStoredPlayback } from '#app/lib/preferences/device-preferences';
import { useHoverPlay } from '../use-hover-play';

function connection(value: unknown) {
  Object.defineProperty(navigator, 'connection', { value, configurable: true });
}

const renderHoverPlay = (Providers: ComponentType<PropsWithChildren> = AppProviders) =>
  renderHook(useHoverPlay, { wrapper: Providers }).result.current;

describe('apps/client/web: useHoverPlay', () => {
  afterEach(() => {
    connection(undefined);
    delete document.documentElement.dataset.motion;
    writeCookie('vp.device', '', { maxAge: 0 });
  });

  it('plays by default', () => {
    expect(renderHoverPlay()).toBe(true);
  });

  it('follows the setting', () => {
    saveStoredPlayback({ hoverPlay: false });

    expect(renderHoverPlay()).toBe(false);
  });

  it.each([
    { label: 'save-data', value: { saveData: true } },
    { label: 'a 2g link', value: { effectiveType: '2g' } },
    { label: 'a slow 2g link', value: { effectiveType: 'slow-2g' } },
  ])('is off under $label, whatever the setting says', ({ value }) => {
    connection(value);

    expect(renderHoverPlay()).toBe(false);
  });

  it('is on over a 4g link', () => {
    connection({ saveData: false, effectiveType: '4g' });

    expect(renderHoverPlay()).toBe(true);
  });

  it('is off under reduced motion', () => {
    document.documentElement.dataset.motion = 'reduced';

    expect(renderHoverPlay()).toBe(false);
  });
});
