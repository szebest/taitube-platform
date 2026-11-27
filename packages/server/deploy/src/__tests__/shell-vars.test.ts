import { shellVars } from '../shell-vars';
import { PRODUCTION } from './fixtures';

describe('shellVars', () => {
  it('flattens nested fields to E_ names, lists to space-joined items and booleans to words', () => {
    const lines = shellVars(PRODUCTION).split('\n');

    expect(lines).toEqual(
      expect.arrayContaining([
        "E_kind='k3s'",
        "E_protected='true'",
        "E_cluster_context='k3s-prod'",
        "E_scaling_maxReplicas_transcode_480p='3'",
        "E_secrets_keys='DATABASE_URL REDIS_PASSWORD S3_ACCESS_KEY_ID S3_SECRET_ACCESS_KEY'",
      ])
    );
  });

  it('quotes a value so a shell reads it back whole', () => {
    expect(shellVars({ description: "it's a $(rm -rf) `x`" })).toBe(
      `E_description='it'\\''s a $(rm -rf) \`x\`'`
    );
  });

  it('skips fields that are not set', () => {
    expect(shellVars({ a: undefined, b: null, c: {} })).toBe('');
  });
});
