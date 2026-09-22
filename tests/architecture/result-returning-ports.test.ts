import { NON_RESULT_PORT_METHODS } from './non-result-port-methods';
import { read, shrinkOnly, trackedFiles } from './repo-files';

/**
 * An I/O method that types as `Promise<T>` hides every way it can fail. `Promise<Result<T, E>>`
 * puts the narrow failure union for that port in the signature, where a caller has to answer it.
 */
const PORT_ROOTS = ['packages/server/core/ports/', 'packages/server/core/repositories/'];
const METHOD = /^\s*(?:abstract\s+)?(\w+)\s*(?:<[^>]*>)?\([^;]*?\):\s*(Promise<[^;]+)/gm;

function portFiles(): string[] {
  return trackedFiles(...PORT_ROOTS).filter(
    (file) => file.endsWith('.ts') && !file.endsWith('index.ts')
  );
}

function asyncMethods(file: string): { name: string; returns: string }[] {
  return [...read(file).matchAll(METHOD)].map((match) => ({
    name: match[1] as string,
    returns: (match[2] as string).replace(/\s+/g, ' ').trim(),
  }));
}

function offenders(): string[] {
  return portFiles().flatMap((file) =>
    asyncMethods(file)
      .filter(({ returns }) => !returns.startsWith('Promise<Result<'))
      .map(({ name }) => `${file}#${name}`)
  );
}

describe('architecture: every I/O port method returns a Result', () => {
  it('parses the port files it is asserting about', () => {
    expect(portFiles().length).toBeGreaterThan(15);
    expect(asyncMethods('packages/server/core/repositories/category-repository.ts')).not.toEqual([]);
  });

  it('sees a converted port as converted', () => {
    expect(offenders().filter((entry) => entry.includes('category-repository'))).toEqual([]);
  });

  it('allows no new port method that hides its failures', () => {
    const { unlisted } = shrinkOnly(offenders(), NON_RESULT_PORT_METHODS);

    expect(unlisted).toEqual([]);
  });

  it('keeps the exception list shrinking: no entry that already returns a Result', () => {
    const { stale } = shrinkOnly(offenders(), NON_RESULT_PORT_METHODS);

    expect(stale).toEqual([]);
  });
});
