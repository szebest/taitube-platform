import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { resolveApiBaseUrl } from '../index';

const SOURCE_ROOT = join(__dirname, '..', '..');
const LOCAL_HOSTS = /^https?:\/\/(localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1\])(:|\/|$)/;
const URL_LITERAL = /https?:\/\/[^\s'"`)]+/g;
/** An XML namespace identifier, never fetched — every inline SVG carries it. */
const XML_NAMESPACE = /^https?:\/\/www\.w3\.org\//;

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    if (entry === '__tests__') return [];
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return /\.(ts|tsx)$/.test(entry) ? [path] : [];
  });
}

describe('apps/web: config', () => {
  it('defaults the API base URL to the local API', () => {
    expect(resolveApiBaseUrl({})).toBe('http://localhost:3000');
  });

  it('reads REACT_APP_API_BASE_URL and drops a trailing slash', () => {
    expect(resolveApiBaseUrl({ REACT_APP_API_BASE_URL: 'http://api.local:8080/' })).toBe(
      'http://api.local:8080'
    );
  });

  it('ignores an empty override rather than producing a relative URL', () => {
    expect(resolveApiBaseUrl({ REACT_APP_API_BASE_URL: '' })).toBe('http://localhost:3000');
  });

  it('phones home nowhere: no source file names a non-local host', () => {
    const offenders = sourceFiles(SOURCE_ROOT).flatMap((file) =>
      (readFileSync(file, 'utf8').match(URL_LITERAL) ?? [])
        .filter((url) => !LOCAL_HOSTS.test(url) && !XML_NAMESPACE.test(url))
        .map((url) => `${file.slice(SOURCE_ROOT.length + 1)}: ${url}`)
    );

    expect(offenders).toEqual([]);
  });
});
