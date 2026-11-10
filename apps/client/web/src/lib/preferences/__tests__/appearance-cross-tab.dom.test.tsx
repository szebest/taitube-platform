import { render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import {
  type AppearancePreference,
  AppearanceProvider,
  DEFAULT_APPEARANCE,
  useAppearance,
} from '@vp/ui';
import { AppearanceCrossTab } from '../appearance-cross-tab';

function Probe() {
  const { preference, update } = useAppearance();

  return (
    <>
      <output>{JSON.stringify(preference)}</output>
      <button type="button" onClick={() => update({ theme: 'nocturne' })}>
        Nocturne
      </button>
    </>
  );
}

function renderTab() {
  render(
    <AppearanceProvider stored={{ preference: DEFAULT_APPEARANCE, source: 'none' }}>
      <AppearanceCrossTab />
      <Probe />
    </AppearanceProvider>
  );
}

const shown = (): AppearancePreference => JSON.parse(screen.getByRole('status').textContent ?? '');

describe('apps/client/web: the appearance across tabs', () => {
  it('posts a change made here for the other tabs, and not the preference it started with', async () => {
    const otherTab = new BroadcastChannel('vp.prefs');
    const heard: { field: string; value: AppearancePreference }[] = [];
    otherTab.onmessage = ({ data }) => heard.push(data);
    renderTab();

    await userEvent.click(screen.getByRole('button', { name: 'Nocturne' }));

    await vi.waitFor(() => expect(heard).toHaveLength(1));
    expect(heard[0]).toMatchObject({ field: 'appearance', value: { theme: 'nocturne' } });
    otherTab.close();
  });

  it('adopts the appearance another tab posted, and does not post it back', async () => {
    const otherTab = new BroadcastChannel('vp.prefs');
    const post = vi.spyOn(BroadcastChannel.prototype, 'postMessage');
    renderTab();

    otherTab.postMessage({ field: 'appearance', value: { ...DEFAULT_APPEARANCE, mode: 'oled' } });

    await vi.waitFor(() => expect(shown().mode).toBe('oled'));
    expect(post).toHaveBeenCalledOnce();
    otherTab.close();
  });

  it.each([
    { label: 'a field that is not the appearance', message: { field: 'locale', value: 'sv-FI' } },
    { label: 'a value that is not an appearance', message: { field: 'appearance', value: 7 } },
  ])('ignores $label', async ({ message }) => {
    const otherTab = new BroadcastChannel('vp.prefs');
    renderTab();

    otherTab.postMessage(message);
    otherTab.postMessage({ field: 'appearance', value: { ...DEFAULT_APPEARANCE, mode: 'oled' } });

    await vi.waitFor(() => expect(shown().mode).toBe('oled'));
    expect(shown()).toEqual({ ...DEFAULT_APPEARANCE, mode: 'oled' });
    otherTab.close();
  });
});
