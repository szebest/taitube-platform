import type { ChannelAttempt } from './channel-attempts';

const NO_ID = '00000000-0000-7000-8000-000000000000';

const ROWS = [
  { name: 'read saved preferences', method: 'GET', path: '/v1/me/preferences' },
  {
    name: 'save preferences',
    method: 'PATCH',
    path: '/v1/me/preferences',
    data: { version: 0, privacy: { historyPaused: true } },
  },
  {
    name: 'stop recommending a video',
    method: 'PUT',
    path: '/v1/me/recommendation-feedback',
    data: { kind: 'not_interested', videoId: NO_ID },
  },
  {
    name: 'read what was stopped being recommended',
    method: 'GET',
    path: '/v1/me/recommendation-feedback',
  },
  {
    name: "remove an entry of another user's recommendation feedback",
    method: 'DELETE',
    path: `/v1/me/recommendation-feedback/${NO_ID}`,
  },
  { name: 'read the search history', method: 'GET', path: '/v1/me/searches' },
  { name: 'clear the search history', method: 'DELETE', path: '/v1/me/searches' },
  {
    name: "remove an entry of another user's search history",
    method: 'DELETE',
    path: `/v1/me/searches/${NO_ID}`,
  },
  { name: 'read the liked videos', method: 'GET', path: '/v1/me/liked-videos' },
  { name: 'read the own comments', method: 'GET', path: '/v1/me/comments' },
] as const;

export const ME_ATTEMPTS: ChannelAttempt[] = ROWS.map((row) => ({
  name: row.name,
  method: row.method,
  path: () => row.path,
  data: 'data' in row ? row.data : undefined,
  callers: ['an anonymous caller'],
}));
