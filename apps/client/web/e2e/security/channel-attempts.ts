import type { Stack } from '../../../../../tests/playwright/fixtures';

export type ChannelAttempt = {
  name: string;
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  path: () => string;
  data?: Record<string, unknown> | ((videoId: string) => Record<string, unknown>);
  target?: keyof Stack['videos'];
  callers: readonly ['an anonymous caller'];
};

export const CHANNEL_ATTEMPTS: ChannelAttempt[] = [
  {
    name: 'read the channel for editing',
    method: 'GET',
    path: () => '/v1/me/channel',
    callers: ['an anonymous caller'],
  },
  {
    name: 'change the channel handle',
    method: 'PATCH',
    path: () => '/v1/me/channel',
    data: { handle: 'hijacked' },
    callers: ['an anonymous caller'],
  },
  {
    name: 'presign an upload for the channel banner',
    method: 'POST',
    path: () => '/v1/me/channel/images/banner/upload',
    data: { contentType: 'image/png', sizeBytes: 1000 },
    callers: ['an anonymous caller'],
  },
  {
    name: 'complete an upload for the channel avatar',
    method: 'POST',
    path: () => '/v1/me/channel/images/avatar/complete',
    data: {
      uploadId: '00000000-0000-7000-8000-000000000000',
      width: 800,
      height: 800,
      crop: { x: 0, y: 0, width: 800, height: 800 },
    },
    callers: ['an anonymous caller'],
  },
  {
    name: 'read the spotlight settings',
    method: 'GET',
    path: () => '/v1/me/channel/spotlight',
    callers: ['an anonymous caller'],
  },
  {
    name: 'set the channel trailer',
    method: 'PUT',
    path: () => '/v1/me/channel/spotlight',
    data: (id) => ({ trailerVideoId: id, returningVideoId: null, localizations: [] }),
    target: 'watchable',
    callers: ['an anonymous caller'],
  },
];
