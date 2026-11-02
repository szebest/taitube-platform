import { quarantineFindings, readQuarantine } from '../../scripts/quarantine/entries';
import { trackedFiles } from './repo-files';

describe('architecture: tests/quarantine.json', () => {
  it('holds at most five entries, each complete and not expired', () => {
    expect(quarantineFindings(readQuarantine(), new Date().toISOString().slice(0, 10))).toEqual([]);
  });

  it('names only specs that exist', () => {
    const tracked = new Set(trackedFiles('apps', 'packages', 'scripts', 'tests'));

    expect(readQuarantine().filter(({ spec }) => !tracked.has(spec))).toEqual([]);
  });
});
