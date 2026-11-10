import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { screeningConfig } from '../screening-config';
import {
  SCREENING_MODEL,
  SCREENING_PROCESS,
  SCREENING_SAMPLING,
  SCREENING_THRESHOLDS,
} from '../tuning';

const LOCK = resolve(import.meta.dirname, '../../../../../apps/server/worker/screening.lock');

function lockValue(key: string): string | undefined {
  const line = readFileSync(LOCK, 'utf8')
    .split('\n')
    .find((entry) => entry.startsWith(`${key}=`));
  return line?.slice(key.length + 1);
}

describe('packages/env-schema: screening config', () => {
  it('hands the switch and the path it was given beside the tuning the screening runs by', () => {
    expect(screeningConfig({ enabled: false, modelPath: '/opt/screening/model.onnx' })).toEqual({
      enabled: false,
      modelPath: '/opt/screening/model.onnx',
      model: SCREENING_MODEL,
      thresholds: SCREENING_THRESHOLDS,
      sampling: SCREENING_SAMPLING,
      process: SCREENING_PROCESS,
    });
  });

  it('pins the checksum the lock file carries, so the image and the adapter name one file', () => {
    const { model } = screeningConfig({ enabled: true, modelPath: 'model.onnx' });

    expect(model.sha256).toBe(lockValue('SCREENING_MODEL_SHA256'));
  });
});
