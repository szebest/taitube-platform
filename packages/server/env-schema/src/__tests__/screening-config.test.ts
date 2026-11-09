import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { screeningConfig } from '../screening-config';
import { SCREENING_MODEL } from '../tuning';

const LOCK = resolve(import.meta.dirname, '../../../../../apps/server/worker/assets.lock');

function lockValue(key: string): string | undefined {
  const line = readFileSync(LOCK, 'utf8')
    .split('\n')
    .find((entry) => entry.startsWith(`${key}=`));
  return line?.slice(key.length + 1);
}

describe('packages/env-schema: screening config', () => {
  it('hands the path it was given beside the model tuning', () => {
    expect(screeningConfig({ modelPath: '/opt/screening/model.onnx' })).toEqual({
      modelPath: '/opt/screening/model.onnx',
      model: SCREENING_MODEL,
    });
  });

  it('pins the checksum the lock file carries, so the image and the adapter name one file', () => {
    const { model } = screeningConfig({ modelPath: 'model.onnx' });

    expect(model.sha256).toBe(lockValue('SCREENING_MODEL_SHA256'));
  });
});
