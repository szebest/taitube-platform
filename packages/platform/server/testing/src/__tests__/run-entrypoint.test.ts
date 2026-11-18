import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { runEntrypoint } from '../run-entrypoint';

describe('@vp/testing: runEntrypoint', () => {
  let dir: string;

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vp-entrypoint-'));
  });

  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('runs a TypeScript entrypoint with its arguments and hands back its output and exit code', () => {
    const entrypoint = path.join(dir, 'main.ts');
    fs.writeFileSync(
      entrypoint,
      "const args: string[] = process.argv.slice(2);\nprocess.stdout.write(args.join(' '));\nprocess.exit(3);\n"
    );

    const ran = runEntrypoint(entrypoint, ['a', 'b'], { PATH: process.env.PATH });

    expect(ran.stdout).toBe('a b');
    expect(ran.status).toBe(3);
  });
});
