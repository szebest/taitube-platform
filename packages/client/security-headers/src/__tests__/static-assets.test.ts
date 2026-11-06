import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { withStaticAssets } from '../static-assets';

const IMMUTABLE = 'max-age=31536000, immutable';

function serveBuild() {
  const dir = mkdtempSync(join(tmpdir(), 'client-build-'));
  mkdirSync(join(dir, 'assets'));
  writeFileSync(join(dir, 'assets', 'index-1a2b3c.js'), 'export {}');
  writeFileSync(join(dir, 'robots.txt'), 'User-agent: *');
  const app = vi.fn(async () => new Response('<html></html>'));
  const serve = withStaticAssets(dir, app);
  return { app, get: (path: string) => serve(new Request(`http://localhost${path}`)) };
}

describe('withStaticAssets', () => {
  it.each([
    { path: '/assets/index-1a2b3c.js', cacheControl: IMMUTABLE },
    { path: '/robots.txt', cacheControl: null },
  ])('serves $path with Cache-Control $cacheControl', async ({ path, cacheControl }) => {
    const { app, get } = serveBuild();

    const response = await get(path);

    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe(cacheControl);
    expect(app).not.toHaveBeenCalled();
  });

  it.each(['/', '/watch/abc', '/assets/missing.js'])(
    'hands %s to the app, with no Cache-Control',
    async (path) => {
      const { app, get } = serveBuild();

      const response = await get(path);

      expect(await response.text()).toBe('<html></html>');
      expect(response.headers.get('cache-control')).toBeNull();
      expect(app).toHaveBeenCalledOnce();
    }
  );
});
