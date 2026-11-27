/**
 * The rows every in-memory `Repositories` and the development seed start with. A spec that acts as
 * "the dev user" or reads "the seeded video" names it from here.
 */
export const SEEDED = {
  userId: '00000000-0000-7000-8000-000000000001',
  otherUserId: '00000000-0000-7000-8000-000000000002',
  channelId: '00000000-0000-7000-8000-000000000101',
  otherChannelId: '00000000-0000-7000-8000-000000000102',
  videoId: '018f0000-0000-7000-8000-000000000001',
  otherVideoId: '018f0000-0000-7000-8000-000000000002',
} as const;

export interface MockJob<T> {
  id: string;
  name: string;
  data: T;
  attemptsMade: number;
  updateProgress: (progress: number | object) => Promise<void>;
}

/** A queue job as a stage receives one, on its first attempt unless `overrides` says otherwise. */
export function createMockJob<T>(
  name: string,
  data: T,
  overrides: Partial<MockJob<T>> = {}
): MockJob<T> {
  return {
    id: `${name}-job`,
    name,
    data,
    attemptsMade: 0,
    updateProgress: async () => {},
    ...overrides,
  };
}
