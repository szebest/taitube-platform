import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { runEntrypoint } from '@vp/testing/run-entrypoint';
import { renderOpenApiDocument } from '../composition/openapi-document';

const ENTRYPOINT = resolve(import.meta.dirname, '../gen-contracts.ts');

describe('apps/api: pnpm gen:contracts', () => {
  it('writes the rendered OpenAPI document to the path it is given', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'gen-contracts-'));
    const target = join(dir, 'openapi.yaml');

    const run = runEntrypoint(ENTRYPOINT, [target], { PATH: process.env.PATH });

    expect(run.status).toBe(0);
    expect(run.stdout).toBe(`wrote ${target}\n`);
    expect(readFileSync(target, 'utf8')).toBe(await renderOpenApiDocument());
    rmSync(dir, { recursive: true });
  });
});
