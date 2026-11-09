import { chmod, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ErrorCodes, PermanentError } from '@vp/errors';
import { expectErr, expectOk } from '@vp/testing/result';
import { buildFpcalcArgs, parseFpcalcOutput, runFpcalc } from '../fpcalc';

describe('@vp/fingerprint: buildFpcalcArgs', () => {
  it.each([
    { durationSeconds: 600, length: '600' },
    { durationSeconds: 600.2, length: '601' },
    { durationSeconds: 0.4, length: '1' },
  ])(
    'fingerprints the whole $durationSeconds s as -length $length',
    ({ durationSeconds, length }) => {
      expect(buildFpcalcArgs({ sourcePath: 'a.mp4', durationSeconds })).toEqual([
        '-raw',
        '-json',
        '-length',
        length,
        'a.mp4',
      ]);
    }
  );
});

describe('@vp/fingerprint: parseFpcalcOutput', () => {
  it('reads the duration and the raw terms, folding unsigned values to signed', () => {
    const output = JSON.stringify({ duration: 12.5, fingerprint: [1, 4294967295, 2147483648] });

    expect(expectOk(parseFpcalcOutput(output))).toEqual({
      durationSeconds: 12.5,
      terms: [1, -1, -2147483648],
    });
  });

  it('accepts a video without audio as an empty sequence', () => {
    expect(expectOk(parseFpcalcOutput('{"duration":0,"fingerprint":[]}')).terms).toEqual([]);
  });

  it.each([
    { name: 'text that is not JSON', output: 'ERROR: Error decoding audio frame' },
    {
      name: 'a base64 fingerprint where raw terms are expected',
      output: '{"duration":1,"fingerprint":"AQAAA"}',
    },
    { name: 'a missing duration', output: '{"fingerprint":[1]}' },
    { name: 'a negative duration', output: '{"duration":-1,"fingerprint":[1]}' },
    { name: 'a fractional term', output: '{"duration":1,"fingerprint":[1.5]}' },
    { name: 'nothing', output: '' },
  ])('fails permanently on $name', ({ output }) => {
    expect(expectErr(parseFpcalcOutput(output))).toMatchObject({
      code: ErrorCodes.CORRUPT_CONTAINER,
    });
  });
});

const FAKE_FPCALC = `#!/bin/sh
case "$(cat "$(dirname "$0")/mode")" in
  ok) printf '{"duration": 3.0,\\n "fingerprint": [7, 8, 9]}\\n' ;;
  garbage) echo 'not json' ;;
  fail) echo "ERROR: could not open the file" >&2; exit 2 ;;
  args) printf '{"duration": 1, "fingerprint": [%s]}\\n' "$#" ;;
esac
`;

describe('@vp/fingerprint: runFpcalc', () => {
  let dir: string;
  const run = () =>
    runFpcalc({
      fpcalcPath: join(dir, 'fpcalc'),
      sourcePath: join(dir, 'in.mp4'),
      durationSeconds: 3,
      timeoutMs: 5000,
      limits: { killGraceMs: 100, stderrTailLines: 10 },
    });

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'vp-fpcalc-'));
    await writeFile(join(dir, 'fpcalc'), FAKE_FPCALC);
    await chmod(join(dir, 'fpcalc'), 0o755);
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it('parses what fpcalc prints across several lines', async () => {
    await writeFile(join(dir, 'mode'), 'ok');

    expect(await run()).toEqual({ durationSeconds: 3, terms: [7, 8, 9] });
  });

  it('hands fpcalc the five arguments of its command line', async () => {
    await writeFile(join(dir, 'mode'), 'args');

    expect((await run()).terms).toEqual([5]);
  });

  it('throws a permanent error for output it cannot read', async () => {
    await writeFile(join(dir, 'mode'), 'garbage');

    await expect(run()).rejects.toBeInstanceOf(PermanentError);
  });

  it('throws the classified process failure when fpcalc exits non-zero', async () => {
    await writeFile(join(dir, 'mode'), 'fail');

    await expect(run()).rejects.toThrow(/exit code 2/);
  });
});
