import type { Stack } from '../../../../../tests/playwright/fixtures';

export type ChannelAttempt = {
  name: string;
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  path: () => string;
  data?: Record<string, unknown> | ((videoId: string) => Record<string, unknown>);
  target?: keyof Stack['videos'];
  callers: readonly ['an anonymous caller'];
};

const NO_POST = '00000000-0000-7000-8000-000000000000';
const NO_THREAD = '00000000-0000-7000-8000-000000000001';

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
  {
    name: 'export the channel comments',
    method: 'POST',
    path: () => '/v1/me/channel/exports',
    data: { kind: 'comments', format: 'csv' },
    callers: ['an anonymous caller'],
  },
  {
    name: 'list the channel exports',
    method: 'GET',
    path: () => '/v1/me/channel/exports',
    callers: ['an anonymous caller'],
  },
  {
    name: 'download a channel export',
    method: 'GET',
    path: () => '/v1/me/channel/exports/00000000-0000-7000-8000-000000000000',
    callers: ['an anonymous caller'],
  },
  {
    name: 'delete a channel export',
    method: 'DELETE',
    path: () => '/v1/me/channel/exports/00000000-0000-7000-8000-000000000000',
    callers: ['an anonymous caller'],
  },
  {
    name: 'publish a channel post',
    method: 'POST',
    path: () => '/v1/me/channel/posts',
    data: { payload: { kind: 'text', text: 'hijacked' } },
    callers: ['an anonymous caller'],
  },
  {
    name: 'edit a channel post',
    method: 'PATCH',
    path: () => `/v1/me/channel/posts/${NO_POST}`,
    data: { payload: { kind: 'text', text: 'hijacked' }, version: 1 },
    callers: ['an anonymous caller'],
  },
  {
    name: 'delete a channel post',
    method: 'DELETE',
    path: () => `/v1/me/channel/posts/${NO_POST}`,
    callers: ['an anonymous caller'],
  },
  {
    name: 'like a post',
    method: 'PUT',
    path: () => `/v1/posts/${NO_POST}/reactions`,
    callers: ['an anonymous caller'],
  },
  {
    name: 'read the community feed',
    method: 'GET',
    path: () => '/v1/feed/community',
    callers: ['an anonymous caller'],
  },
  {
    name: 'start a thread on a video',
    method: 'POST',
    path: () => `/v1/videos/${NO_POST}/threads`,
    data: { anchorMs: 0, title: 'hijacked', body: '' },
    callers: ['an anonymous caller'],
  },
  {
    name: 'reply in a thread',
    method: 'POST',
    path: () => `/v1/threads/${NO_THREAD}/comments`,
    data: { content: 'hijacked' },
    callers: ['an anonymous caller'],
  },
  {
    name: 'pin a thread',
    method: 'POST',
    path: () => `/v1/threads/${NO_THREAD}/pin`,
    callers: ['an anonymous caller'],
  },
  {
    name: 'unpin a thread',
    method: 'DELETE',
    path: () => `/v1/threads/${NO_THREAD}/pin`,
    callers: ['an anonymous caller'],
  },
  {
    name: 'remove a thread',
    method: 'POST',
    path: () => `/v1/threads/${NO_THREAD}/remove`,
    data: { disclosure: 'silent' },
    callers: ['an anonymous caller'],
  },
];
