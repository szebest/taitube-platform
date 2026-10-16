import { clientApps } from './client-apps';
import { productionSources, read, trackedFiles } from './repo-files';

const URL_LITERAL = /\bhttps?:\/\/[^\s'"`)\\<>]+/g;
const HOST = /^https?:\/\/([^/:?#]+)/;
const LOOPBACK = new Set(['localhost', '127.0.0.1', '0.0.0.0', '[::1]']);
const XML_NAMESPACE = 'www.w3.org';
/** TanStack Start renders the whole HTML document from each app's root route; there is no static shell. */
const APP_DOCUMENTS = clientApps().map((app) => `${app}/src/routes/__root.tsx`);

function isLocal(url: string): boolean {
  const host = HOST.exec(url)?.[1];
  if (!host) return false;
  if (host.includes('${')) return true;

  return (
    LOOPBACK.has(host) || host === XML_NAMESPACE || host.endsWith('.local') || !host.includes('.')
  );
}

function externalHosts(source: string): string[] {
  return (source.match(URL_LITERAL) ?? []).filter((url) => !isLocal(url));
}

function activeEnvLines(): string[] {
  return read('.env.example')
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith('#'));
}

describe('architecture: local-first', () => {
  it('still recognises a host that would phone home', () => {
    expect(externalHosts("const api = 'https://taitube-backend.onrender.com';")).toEqual([
      'https://taitube-backend.onrender.com',
    ]);
    expect(externalHosts("fetch('http://localhost:3000/v1/feed')")).toEqual([]);
    expect(externalHosts('fetch(`https://cdn.example.com/${key}`)')).toEqual([
      'https://cdn.example.com/${key}',
    ]);
  });

  it('names no external host in production source', () => {
    const offenders = productionSources().flatMap((file) =>
      externalHosts(read(file)).map((url) => `${file}: ${url}`)
    );

    expect(offenders).toEqual([]);
  });

  it('imports no stylesheet or font from another host in the client app styles', () => {
    const styles = trackedFiles(
      ...clientApps().flatMap((app) => [`:(glob)${app}/src/**/*.scss`, `:(glob)${app}/src/**/*.css`])
    );
    const offenders = styles.flatMap((file) =>
      externalHosts(read(file)).map((url) => `${file}: ${url}`)
    );

    expect(styles).toContain('apps/client/web/src/styles/abstract/_mixins.scss');
    expect(styles).toContain('apps/client/studio/src/studio.css');
    expect(offenders).toEqual([]);
  });

  it('loads nothing from another host in a client app document or the HLS test page', () => {
    const pages = [...APP_DOCUMENTS, ...trackedFiles(':(glob)tools/hls-test-page/*.html')];
    const offenders = pages.flatMap((file) =>
      externalHosts(read(file)).map((url) => `${file}: ${url}`)
    );

    expect(trackedFiles(...APP_DOCUMENTS)).toEqual(APP_DOCUMENTS);
    expect(pages).toContain('tools/hls-test-page/index.html');
    expect(offenders).toEqual([]);
  });

  it('keeps every uncommented .env.example default on this machine', () => {
    const offenders = activeEnvLines().filter((line) => externalHosts(line).length > 0);

    expect(offenders).toEqual([]);
  });
});
