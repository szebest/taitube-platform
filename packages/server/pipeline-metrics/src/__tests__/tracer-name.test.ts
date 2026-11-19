import { TRACER_NAME } from '../tracer-name';

describe('TRACER_NAME', () => {
  it('is the instrumentation scope every span of the product is recorded under', () => {
    expect(TRACER_NAME).toBe('video-pipeline');
  });
});
