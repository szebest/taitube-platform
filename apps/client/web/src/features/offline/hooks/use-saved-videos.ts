import { useQuery } from '@tanstack/react-query';
import { listSavedVideos } from '../saved/list-saved-videos';
import type { SavedVideo } from '../saved/saved-video';
import { useCanSaveOffline } from './use-can-save-offline';

export const savedVideoKeys = { all: ['saved-videos'] as const };

const NONE: SavedVideo[] = [];

/** The saved videos, newest first, read from the saved cache; it answers with no network, so it never pauses. */
export function useSavedVideos(): SavedVideo[] {
  const canSave = useCanSaveOffline();
  const { data } = useQuery({
    queryKey: savedVideoKeys.all,
    queryFn: () => listSavedVideos(window.caches),
    enabled: canSave,
    networkMode: 'always',
  });
  return data ?? NONE;
}
