export const TEAM_REFUSED = [
  { caller: 'an editor', persona: 'editor', method: 'DELETE', path: '/v1/videos' },
  { caller: 'an editor', persona: 'editor', method: 'DELETE', path: '/v1/creator/videos' },
  {
    caller: 'a moderator',
    persona: 'moderator',
    method: 'PATCH',
    path: '/v1/videos',
    data: { title: 'hijacked', version: 1 },
  },
  {
    caller: 'a moderator',
    persona: 'moderator',
    method: 'PATCH',
    path: '/v1/creator/videos',
    data: { title: 'hijacked', version: 1 },
  },
] as const;
