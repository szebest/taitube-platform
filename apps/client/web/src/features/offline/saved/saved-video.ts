import { z } from 'zod';

export const SavedVideoSchema = z.object({
  id: z.string(),
  title: z.string(),
  savedAt: z.number(),
  bytes: z.number(),
  urls: z.array(z.string()),
});

export type SavedVideo = z.infer<typeof SavedVideoSchema>;

export const SAVED_LIMITS = {
  videos: 10,
  bytesPerVideo: 10 * 1024 * 1024,
  segments: 6,
} as const;

export type SaveFailure =
  | { reason: 'limit'; limit: number }
  | { reason: 'unavailable' }
  | { reason: 'quota' }
  | { reason: 'failed' };

type SavedCache = Pick<Cache, 'match' | 'put' | 'delete'>;

export interface SavedStorage {
  storage: { open(name: string): Promise<SavedCache> };
  fetch: typeof fetch;
  origin: string;
}
