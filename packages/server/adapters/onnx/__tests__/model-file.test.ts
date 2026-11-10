import { createHash } from 'node:crypto';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ErrorCodes } from '@vp/errors';
import { expectErr, expectOk } from '@vp/testing/result';
import { verifyModelFile } from '../model-file';

const BYTES = Buffer.from('model bytes');
const sha256 = (bytes: Buffer) => createHash('sha256').update(bytes).digest('hex');

describe('verifyModelFile', () => {
  let dir: string;
  let file: string;

  beforeAll(() => {
    dir = mkdtempSync(join(tmpdir(), 'verify-model-'));
    file = join(dir, 'model.onnx');
    writeFileSync(file, BYTES);
  });

  afterAll(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it('accepts the file whose SHA-256 is the pinned one', async () => {
    expectOk(await verifyModelFile(file, sha256(BYTES)));
  });

  it.each([
    {
      scenario: 'a file with another checksum',
      path: () => file,
      pin: () => sha256(Buffer.from('other')),
      message: 'the lock file pins',
    },
    {
      scenario: 'a file that is not there',
      path: () => join(dir, 'gone.onnx'),
      pin: () => sha256(BYTES),
      message: 'cannot be read',
    },
  ])('refuses $scenario as a model that will never be right', async ({ path, pin, message }) => {
    const failure = expectErr(await verifyModelFile(path(), pin()));

    expect(failure.code).toBe(ErrorCodes.SCREEN_MODEL_INVALID);
    expect(failure.message).toContain(message);
  });
});
