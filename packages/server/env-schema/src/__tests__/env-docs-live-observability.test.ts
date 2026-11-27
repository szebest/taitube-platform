import { LIVE_DOCS, OBSERVABILITY_DOCS, WATCH_PARTY_DOCS } from '../env-docs-live-observability';

describe('packages/env-schema: env-docs-live-observability', () => {
  it.each([
    { group: 'live', docs: LIVE_DOCS },
    { group: 'watch-party', docs: WATCH_PARTY_DOCS },
    { group: 'observability', docs: OBSERVABILITY_DOCS },
  ])('files every $group entry under $group', ({ group, docs }) => {
    expect(Object.values(docs).filter((doc) => doc.group !== group)).toEqual([]);
    expect(Object.keys(docs).length).toBeGreaterThan(0);
  });
});
