import { describe, expect, it } from 'vitest';
import { createServiceInfo } from '../index.js';

describe('@vp/observability smoke test', () => {
  it('creates valid service info', () => {
    const info = createServiceInfo('vp-api', '1.0.0', 'test');
    expect(info.name).toBe('vp-api');
    expect(info.version).toBe('1.0.0');
    expect(info.environment).toBe('test');
  });
});
