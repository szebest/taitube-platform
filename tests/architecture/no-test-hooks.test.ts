import { productionSources, read } from './repo-files';

/**
 * A fault a test needs is a failing double of the port the code calls. A flag in production code
 * or a field in a job contract is a fault anyone who can send a request or enqueue a job can fire.
 */
const HOOK = /forceFailure|forceThumbnailFailure|simulateFailure|testCrash|x-test-|killAtPercent/g;

function hooks(source: string): string[] {
  return source.match(HOOK) ?? [];
}

describe('architecture: no fault injection in production code or wire contracts', () => {
  it.each([
    "const crash = request.headers['x-test-crash-after-commit'] === 'true';",
    'export const ThumbnailJob = z.object({ forceFailure: z.boolean().optional() });',
    'if (simulateFailureRendition === rendition.name) return failTranscode();',
    'await client.uploadFile({ filePath, killAtPercent: 50 });',
  ])('recognises %s', (source) => {
    expect(hooks(source)).not.toEqual([]);
  });

  it('finds no test hook in production source, the job contracts included', () => {
    const sources = productionSources();
    const offenders = sources.filter((file) => hooks(read(file)).length > 0);

    expect(sources).toContain('packages/server/job-contracts/src/index.ts');
    expect(offenders).toEqual([]);
  });
});
