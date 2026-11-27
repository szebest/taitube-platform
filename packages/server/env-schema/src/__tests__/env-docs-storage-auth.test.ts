import { AUTH_DOCS, STORAGE_DOCS } from '../env-docs-storage-auth';

describe('packages/env-schema: env-docs-storage-auth', () => {
  it.each([
    { group: 'storage', docs: STORAGE_DOCS },
    { group: 'auth', docs: AUTH_DOCS },
  ])('files every $group entry under $group', ({ group, docs }) => {
    expect(Object.values(docs).filter((doc) => doc.group !== group)).toEqual([]);
    expect(Object.keys(docs).length).toBeGreaterThan(0);
  });
});
