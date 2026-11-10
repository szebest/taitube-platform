import { resolveTag } from '../image-tag';

describe('resolveTag', () => {
  it.each([
    { configured: 'latest', override: undefined, sha: 'abc', expected: 'latest' },
    { configured: 'latest', override: 'v1.2.3', sha: 'abc', expected: 'v1.2.3' },
    { configured: '{sha}', override: undefined, sha: 'abc123', expected: 'sha-abc123' },
    { configured: '{sha}', override: 'v2', sha: 'abc123', expected: 'v2' },
    { configured: '{sha}', override: undefined, sha: undefined, expected: undefined },
    { configured: '{sha}', override: undefined, sha: '', expected: undefined },
  ])(
    'turns $configured, override $override and HEAD $sha into $expected',
    ({ configured, override, sha, expected }) => {
      expect(resolveTag(configured, override, sha)).toBe(expected);
    }
  );
});
