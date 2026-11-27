import { PIPELINE_DOCS } from '../env-docs-pipeline';

describe('packages/env-schema: env-docs-pipeline', () => {
  it('files every entry under pipeline', () => {
    expect(Object.values(PIPELINE_DOCS).filter((doc) => doc.group !== 'pipeline')).toEqual([]);
    expect(Object.keys(PIPELINE_DOCS).length).toBeGreaterThan(0);
  });
});
