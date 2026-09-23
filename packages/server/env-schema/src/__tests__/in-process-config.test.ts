import { inProcessAppConfig } from '../in-process-config';

describe('packages/env-schema: inProcessAppConfig', () => {
  it('runs an in-process app on the in-memory family over the schema defaults', () => {
    expect(inProcessAppConfig()).toMatchObject({
      kind: 'in-memory',
      buckets: { raw: 'raw', public: 'public' },
      limits: { maxInflightPerUser: 3 },
    });
  });

  it('merges a nested override without dropping its siblings', () => {
    const config = inProcessAppConfig({
      buckets: { raw: 'vp-raw' },
      limits: { maxUploadBytes: 10 },
    });

    expect(config.buckets).toEqual({ raw: 'vp-raw', public: 'public' });
    expect(config.limits).toMatchObject({ maxUploadBytes: 10, maxInflightPerUser: 3 });
  });

  it('brands an overridden CDN base the way the schema does', () => {
    expect(inProcessAppConfig({ cdn: 'http://cdn.local///' }).cdn).toBe('http://cdn.local');
  });

  it('takes a different adapter family as plain configuration', () => {
    expect(inProcessAppConfig({ kind: 'external' }).kind).toBe('external');
  });
});
