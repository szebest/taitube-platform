import { CORE_DOCS, POSTGRES_DOCS, REDIS_DOCS } from '../env-docs-core';

describe('packages/env-schema: env-docs-core', () => {
  it.each([
    { group: 'core', docs: CORE_DOCS },
    { group: 'postgres', docs: POSTGRES_DOCS },
    { group: 'redis', docs: REDIS_DOCS },
  ])('files every $group entry under $group', ({ group, docs }) => {
    expect(Object.values(docs).filter((doc) => doc.group !== group)).toEqual([]);
    expect(Object.keys(docs).length).toBeGreaterThan(0);
  });
});
