import { execFileSync } from 'node:child_process';
import * as crypto from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { isOk, tryCatch } from '@vp/result';
import type { FixtureManifest, ProbeResult } from './types';

export function loadManifest(): FixtureManifest {
  const manifestPath = path.resolve(__dirname, '..', 'manifest.json');
  const content = fs.readFileSync(manifestPath, 'utf-8');
  return JSON.parse(content) as FixtureManifest;
}

export function probeFile(filePath: string): ProbeResult | null {
  const probed = tryCatch(
    (): ProbeResult =>
      JSON.parse(
        execFileSync(
          'ffprobe',
          ['-v', 'quiet', '-print_format', 'json', '-show_format', '-show_streams', filePath],
          { encoding: 'utf-8', maxBuffer: 10 * 1024 * 1024 }
        )
      ),
    (cause) => cause
  );
  return isOk(probed) ? probed.value : null;
}

export function calculateSha256(filePath: string): string {
  const content = fs.readFileSync(filePath);
  return crypto.createHash('sha256').update(content).digest('hex');
}
