import type { ChannelAttempt } from './channel-attempts';

const NO_ID = '00000000-0000-7000-8000-000000000000';

const ROWS = [
  { name: 'read the channel page draft', method: 'GET', path: '/v1/me/channel/page/draft' },
  {
    name: 'save the channel page draft',
    method: 'PUT',
    path: '/v1/me/channel/page/draft',
    data: {
      document: { schemaVersion: 1, landing: { visitor: 'home', subscriber: 'home' }, tabs: [] },
      version: 0,
    },
  },
  {
    name: 'publish the channel page',
    method: 'POST',
    path: '/v1/me/channel/page/publish',
    data: { version: 1 },
  },
  { name: 'list the channel page schedules', method: 'GET', path: '/v1/me/channel/page/schedule' },
  {
    name: 'schedule the channel page',
    method: 'POST',
    path: '/v1/me/channel/page/schedule',
    data: { publishAt: '2030-01-01T00:00:00.000Z', source: 'draft' },
  },
  {
    name: 'cancel a channel page schedule',
    method: 'DELETE',
    path: `/v1/me/channel/page/schedule/${NO_ID}`,
  },
  { name: 'list the channel page revisions', method: 'GET', path: '/v1/me/channel/page/revisions' },
  {
    name: 'restore a channel page revision',
    method: 'POST',
    path: `/v1/me/channel/page/revisions/${NO_ID}/restore`,
  },
  {
    name: 'preview the channel page draft',
    method: 'GET',
    path: '/v1/me/channel/page/preview?as=visitor',
  },
] as const;

export const PAGE_ATTEMPTS: ChannelAttempt[] = ROWS.map((row) => ({
  name: row.name,
  method: row.method,
  path: () => row.path,
  ...('data' in row ? { data: row.data } : {}),
  callers: ['an anonymous caller'] as const,
}));

export const PAGE_TEAM_REFUSED = ROWS.map((row) => ({
  persona: 'moderator' as const,
  name: row.name,
  method: row.method,
  path: row.path,
  data: 'data' in row ? row.data : undefined,
}));
