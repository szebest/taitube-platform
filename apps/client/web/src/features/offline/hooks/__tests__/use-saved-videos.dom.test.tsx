import { renderHook, waitFor } from '@testing-library/react';
import { useSavedVideos } from '../use-saved-videos';
import { queryWrapper, supportedStorageHolding } from './saved-hook-fixtures';

const record = (id: string, savedAt: number) => ({ id, title: id, savedAt, bytes: 1, urls: [] });

describe('apps/client/web: useSavedVideos', () => {
  it('reads the saved videos from the cache, newest first', async () => {
    await supportedStorageHolding([record('old', 1), record('new', 2)]);

    const { result } = renderHook(() => useSavedVideos(), { wrapper: queryWrapper() });

    await waitFor(() => expect(result.current.map(({ id }) => id)).toEqual(['new', 'old']));
  });

  it('is empty where the browser cannot save offline', () => {
    vi.stubGlobal('caches', undefined);

    const { result } = renderHook(() => useSavedVideos(), { wrapper: queryWrapper() });

    expect(result.current).toEqual([]);
  });
});
