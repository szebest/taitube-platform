import { act, renderHook, waitFor } from '@testing-library/react';
import { CACHE_NAMES } from '#app/sw/cache-names';
import { cdnFetch, savableVideo } from '#app/features/offline/saved/__tests__/saved-fixtures';
import { useSaveOffline } from '../use-save-offline';
import { queryWrapper, supportedStorageHolding } from './saved-hook-fixtures';

describe('apps/client/web: useSaveOffline', () => {
  it('saves a video, then removes it', async () => {
    const storage = await supportedStorageHolding([]);
    vi.stubGlobal('fetch', cdnFetch());
    const video = savableVideo();
    const { result } = renderHook(() => useSaveOffline(video), { wrapper: queryWrapper() });
    await waitFor(() => expect(result.current.saved).toBe(false));

    let saved: Awaited<ReturnType<typeof result.current.toggle>> | undefined;
    await act(async () => {
      saved = await result.current.toggle();
    });

    expect(saved).toEqual({ ok: true, value: 'saved' });
    await waitFor(() => expect(result.current.saved).toBe(true));
    expect(storage.held(CACHE_NAMES.saved)).toContain(video.playbackUrl);

    let removed: Awaited<ReturnType<typeof result.current.toggle>> | undefined;
    await act(async () => {
      removed = await result.current.toggle();
    });

    expect(removed).toEqual({ ok: true, value: 'removed' });
    await waitFor(() => expect(result.current.saved).toBe(false));
    expect(storage.held(CACHE_NAMES.saved)).not.toContain(video.playbackUrl);
  });

  it('reports a video that cannot be saved', async () => {
    await supportedStorageHolding([]);
    vi.stubGlobal('fetch', cdnFetch());
    const { result } = renderHook(() => useSaveOffline(savableVideo({ renditions: [] })), {
      wrapper: queryWrapper(),
    });

    let outcome: Awaited<ReturnType<typeof result.current.toggle>> | undefined;
    await act(async () => {
      outcome = await result.current.toggle();
    });

    expect(outcome).toEqual({ ok: false, error: { reason: 'unavailable' } });
  });
});
