import { ENV_GROUPS, groupDocs } from '../env-doc';

describe('packages/env-schema: env-doc', () => {
  it('stamps every entry of a group with that group and keeps the body', () => {
    const body = {
      description: 'The port.',
      example: '3000',
      visibility: 'public',
      readBy: ['api'],
    } as const;

    expect(groupDocs('core', { PORT: body, METRICS_PORT: body })).toEqual({
      PORT: { ...body, group: 'core' },
      METRICS_PORT: { ...body, group: 'core' },
    });
  });

  it('names each group once, with a title and a summary', () => {
    const ids = ENV_GROUPS.map(({ id }) => id);

    expect(new Set(ids).size).toBe(ids.length);
    expect(ENV_GROUPS.filter(({ title, summary }) => !title || !summary)).toEqual([]);
  });
});
