import type { Stack } from '../../../../../tests/playwright/fixtures';

export type ChannelAttempt = {
  name: string;
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  path: () => string;
  data?: Record<string, unknown> | ((videoId: string) => Record<string, unknown>);
  target?: keyof Stack['videos'];
};

export const CHANNEL_ATTEMPTS: ChannelAttempt[] = [
  {
    name: "read another creator's channel for editing",
    method: 'GET',
    path: () => '/v1/me/channel',
  },
  {
    name: "change another creator's channel handle",
    method: 'PATCH',
    path: () => '/v1/me/channel',
    data: { handle: 'hijacked' },
  },
  {
    name: "presign an upload for another creator's channel banner",
    method: 'POST',
    path: () => '/v1/me/channel/images/banner/upload',
    data: { contentType: 'image/png', sizeBytes: 1000 },
  },
  {
    name: "complete an upload for another creator's channel avatar",
    method: 'POST',
    path: () => '/v1/me/channel/images/avatar/complete',
    data: {
      uploadId: '00000000-0000-7000-8000-000000000000',
      width: 800,
      height: 800,
      crop: { x: 0, y: 0, width: 800, height: 800 },
    },
  },
  {
    name: "read another creator's spotlight settings",
    method: 'GET',
    path: () => '/v1/me/channel/spotlight',
  },
  {
    name: "set another creator's channel trailer",
    method: 'PUT',
    path: () => '/v1/me/channel/spotlight',
    data: (id) => ({ trailerVideoId: id, returningVideoId: null, localizations: [] }),
    target: 'watchable',
  },
];
