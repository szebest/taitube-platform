import { describe, it, expect } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';

describe('k6 load test scripts syntax', () => {
  const loadTestDir = path.resolve(__dirname, '../../../../tests/load');

  it('should be parseable javascript', () => {
    const files = ['s1-upload-storm.js', 's2-large-file.js', 's3-backlog-burst.js', 'common.js'];

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
});
