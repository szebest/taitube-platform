import type { VideoResource } from '../types/index.js';

/**
 * Normalizes any video-like input into a canonical VideoResource.
 * Handles ownerId fallback from userId and defaults visibility to 'public'.
 */
export function normalizeVideoResource(
  input?: Partial<VideoResource> | null
): VideoResource | undefined {
  if (!input) return undefined;

  const ownerId = input.ownerId ?? input.userId;
  const visibility = input.visibility ?? 'public';

  return {
    ...input,
    visibility,
    ...(ownerId !== undefined ? { ownerId } : {}),
  };
}
