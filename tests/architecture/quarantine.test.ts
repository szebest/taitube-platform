import {
  excludedBy,
  quarantineFindings,
  readQuarantine,
  vitestExclude,
} from '../../scripts/quarantine/entries';
import { isSpec, trackedFiles } from './repo-files';

describe('architecture: tests/quarantine.json', () => {
  it('holds at most five entries, each complete and not expired', () => {
    expect(quarantineFindings(readQuarantine(), new Date().toISOString().slice(0, 10))).toEqual([]);
  });

  it('excludes from CI exactly the spec each entry names, which exists', () => {
    const specs = trackedFiles('apps', 'packages', 'scripts', 'tests').filter(isSpec);

    expect(
      readQuarantine().filter(({ spec }) => excludedBy(vitestExclude(spec), specs).join() !== spec)
    ).toEqual([]);
  });
});
