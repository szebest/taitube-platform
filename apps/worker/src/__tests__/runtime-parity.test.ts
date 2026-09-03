import * as fs from 'node:fs';
import * as path from 'node:path';
import { describe, expect, it } from 'vitest';

function getSourceFiles(dir: string): string[] {
  const results: string[] = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === '__tests__' || entry.name === '__mocks__') {
        continue;
      }
      results.push(...getSourceFiles(fullPath));
    } else if (entry.isFile() && (entry.name.endsWith('.ts') || entry.name.endsWith('.js'))) {
      results.push(fullPath);
    }
  }
  return results;
}

describe('@vp/worker dual-runtime parity gate (SDD §2.3, ADR-01)', () => {
  const isBun = typeof (globalThis as unknown as { Bun?: unknown }).Bun !== 'undefined';

  it('detects runtime accurately', () => {
    if (isBun) {
      expect(typeof (globalThis as unknown as { Bun?: unknown }).Bun).toBe('object');
    } else {
      expect(typeof (globalThis as unknown as { Bun?: unknown }).Bun).toBe('undefined');
    }
  });

  it('enforces runtime-neutrality: forbids Bun.* APIs in worker source (unit-bun gate)', () => {
    // Under Node (unit job), Node LTS tests pass when Bun-only constructs are
    // conditionally placed (e.g. guarded with typeof Bun !== 'undefined').
    // Under Bun (unit-bun job), this parity gate enforces zero Bun.* API usage in worker source.
    if (!isBun) {
      // In Node environment, pass cleanly so unit stays green.
      return;
    }

    const srcDir = path.resolve(__dirname, '..');
    const sourceFiles = getSourceFiles(srcDir);
    const violations: string[] = [];

    const bunApiRegex = /\bBun\.[a-zA-Z0-9_]+/g;

    for (const file of sourceFiles) {
      const content = fs.readFileSync(file, 'utf-8');
      const matches = content.match(bunApiRegex);
      if (matches && matches.length > 0) {
        const relPath = path.relative(srcDir, file).replace(/\\/g, '/');
        violations.push(`${relPath}: ${matches.join(', ')}`);
      }
    }

    expect(
      violations,
      `Runtime parity violation: Worker code must remain runtime-neutral (SDD §2.3, ADR-01, AGENTS.md rule 2). Found Bun-specific API calls:\n${violations.join('\n')}`
    ).toEqual([]);
  });
});
