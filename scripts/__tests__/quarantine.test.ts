import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { readQuarantine, vitestExclude } from '../quarantine/entries';

describe('pnpm quarantine', () => {
  it('prints an --exclude flag per quarantined spec, nothing for an empty quarantine', () => {
    const printed = execFileSync(
      'pnpm',
      ['exec', 'tsx', join(import.meta.dirname, '../quarantine.ts')],
      {
        encoding: 'utf8',
      }
    );

    expect(printed).toBe(
      readQuarantine()
        .map(({ spec }) => `--exclude=${vitestExclude(spec)}`)
        .join(' ')
    );
  });
});
