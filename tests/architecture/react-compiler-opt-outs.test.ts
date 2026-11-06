import { read, trackedFiles } from './repo-files';
import { MANUAL_MEMO_ALLOWLIST } from './zero-matches-react-rows';

const BASELINE = 'tests/react-compiler/baseline.json';
const ISSUE = /^https:\/\/github\.com\/[\w.-]+\/[\w.-]+\/issues\/\d+$/;

type BaselineEntry = { reason: string; issue: string };

const baseline: Record<string, BaselineEntry> = JSON.parse(read(BASELINE));

describe('architecture: React Compiler opt-outs', () => {
  it('gives every baseline entry a tracked file, a reason and an issue link', () => {
    const tracked = new Set(trackedFiles(...Object.keys(baseline)));
    const broken = Object.entries(baseline).filter(
      ([file, { reason, issue }]) =>
        !tracked.has(file) || reason.trim() === '' || !ISSUE.test(issue)
    );

    expect(broken.map(([file]) => file)).toEqual([]);
  });

  it('keeps a manual memo allowlist entry only while its file memoizes, with a reason', () => {
    const stale = Object.entries(MANUAL_MEMO_ALLOWLIST).filter(
      ([file, reason]) =>
        reason.trim() === '' ||
        trackedFiles(file).length === 0 ||
        !/\b(?:useMemo|useCallback|memo)\s*[<(]/.test(read(file))
    );

    expect(stale.map(([file]) => file)).toEqual([]);
  });
});
