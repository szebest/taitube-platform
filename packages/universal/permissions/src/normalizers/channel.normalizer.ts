import type { ChannelResource } from '../types/index.js';

/**
 * Normalizes any channel-like input into a canonical ChannelResource.
 * Resolves ownerId fallback from userId.
 */
export function normalizeChannelResource(
  input?: Partial<ChannelResource> | null
): ChannelResource | undefined {
  if (!input) return undefined;

  const ownerId = input.ownerId ?? input.userId;

  return {
    ...input,
    ...(ownerId !== undefined ? { ownerId } : {}),
  };
}
