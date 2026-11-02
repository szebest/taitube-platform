import { act, renderHook } from '@testing-library/react';
import type { PropsWithChildren } from 'react';

import {
  PlayerChannelProvider,
  useOfferedPlayerChannel,
} from '#app/features/player/player-channel';
import { DEFAULT_DEVICE_PREFERENCES } from '#app/features/settings/__tests__/device-preferences-fixtures';
import { PreferencesSyncContext } from '#app/features/settings/components/preferences-sync.context';
import { DevicePreferencesProvider } from '#app/features/settings/device/device-preferences-provider';
import { useAutoplayNext } from '../use-autoplay-next';

const router = vi.hoisted(() => ({ navigate: vi.fn() }));

vi.mock(import('@tanstack/react-router'), async (importOriginal) => ({
  ...(await importOriginal()),
  useNavigate: () => router.navigate,
}));

const queued = (id: string) => ({ id });

function renderAutoplayNext({
  autoplayNext = true,
  queue = [queued('a'), queued('b'), queued('c')],
  recommended = [queued('r1'), queued('r2')],
  currentId = 'a',
}: {
  autoplayNext?: boolean;
  queue?: { id: string }[];
  recommended?: { id: string }[];
  currentId?: string;
} = {}) {
  const initial = {
    ...DEFAULT_DEVICE_PREFERENCES,
    playback: { ...DEFAULT_DEVICE_PREFERENCES.playback, autoplayNext },
  };
  const wrapper = ({ children }: PropsWithChildren) => (
    <PreferencesSyncContext value={{ signedIn: false, save: vi.fn(), notSaved: new Set() }}>
      <DevicePreferencesProvider initial={initial}>
        <PlayerChannelProvider>{children}</PlayerChannelProvider>
      </DevicePreferencesProvider>
    </PreferencesSyncContext>
  );
  const { result } = renderHook(
    () => {
      useAutoplayNext({ queue, recommended, currentId });
      return useOfferedPlayerChannel();
    },
    { wrapper }
  );

  return { endVideo: () => act(() => result.current?.end()) };
}

describe('apps/client/web: useAutoplayNext', () => {
  it.each([
    { scenario: 'the next video in the queue', options: {}, to: 'b' },
    {
      scenario: 'the first recommendation after the last queued',
      options: { currentId: 'c' },
      to: 'r1',
    },
    {
      scenario: 'the first recommendation for a video outside the queue',
      options: { currentId: 'x' },
      to: 'r1',
    },
    {
      scenario: 'nothing with nothing to follow',
      options: { currentId: 'c', recommended: [] },
      to: undefined,
    },
    { scenario: 'nothing with autoplay next off', options: { autoplayNext: false }, to: undefined },
  ])('opens $scenario when the video ends', ({ options, to }) => {
    const { endVideo } = renderAutoplayNext(options);

    endVideo();

    expect(router.navigate.mock.calls).toEqual(
      to === undefined
        ? []
        : [[{ to: '/watch/$videoId', params: { videoId: to }, state: { autoplay: true } }]]
    );
  });
});
