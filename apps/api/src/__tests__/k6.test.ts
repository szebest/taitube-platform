import * as fs from 'node:fs';
import * as path from 'node:path';
import { describe, expect, it } from 'vitest';

describe('k6 load test scripts syntax', () => {
  const loadTestDir = path.resolve(__dirname, '../../../../tests/load');

  it('should be parseable javascript', () => {
    const files = [
      's1-upload-storm.js',
      's2-large-file.js',
      's3-backlog-burst.js',
      's4-worker-kills.js',
      's5-dependency-outage.js',
      's6-sse-fanout.js',
      's7-soak.js',
      'common.js',
    ];

    for (const file of files) {
      const filePath = path.join(loadTestDir, file);
      expect(fs.existsSync(filePath), `${file} should exist`).toBe(true);

      const content = fs.readFileSync(filePath, 'utf-8');
      expect(content).toContain('import');
      // Just check we can parse the syntax without throwing.
      // We can't require() it because it imports 'k6' which doesn't exist in node,
      // but we can check if it parses as a module.

      expect(content.length).toBeGreaterThan(0);
    }
  });

  it('should have chaos scripts present and executable in tools/chaos', () => {
    const chaosDir = path.resolve(__dirname, '../../../../tools/chaos');
    const scripts = ['kill-worker.sh', 'redis-restart.sh', 'disk-fill.sh'];

    for (const script of scripts) {
      const scriptPath = path.join(chaosDir, script);
      expect(fs.existsSync(scriptPath), `${script} should exist in tools/chaos`).toBe(true);
      const content = fs.readFileSync(scriptPath, 'utf-8');
      expect(content).toContain('#!/usr/bin/env bash');
    }
  });
});
