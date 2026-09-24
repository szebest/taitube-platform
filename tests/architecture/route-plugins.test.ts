import { basename } from 'node:path';
import { productionSources, read } from './repo-files';

const ROUTES_DIR = 'apps/api/src/routes/';
const REGISTERS = /\.(?:get|post|put|patch|delete)\(\s*(?:\w+\.)?path\b|\.register\(/;
const PLUGIN = /^export async function (\w+Routes)\(app: FastifyInstance\): Promise<void> \{/m;
const OPTIONS_INTERFACE = /^export interface \w*Options\b/m;

function routeModules(): string[] {
  return productionSources().filter(
    (file) =>
      file.startsWith(ROUTES_DIR) && basename(file) !== 'index.ts' && REGISTERS.test(read(file))
  );
}

function pluginName(source: string): string | undefined {
  return PLUGIN.exec(source)?.[1];
}

describe('architecture: every route module is a plugin registered from one table', () => {
  it('recognises a module that exports a bare registrar instead of a plugin', () => {
    const registrar =
      'export function registerVideosRoutes(app: FastifyInstance, options: VideosRouteOptions): void {\n  server.get(path, handler);\n}';

    expect(pluginName(registrar)).toBeUndefined();
    expect(
      OPTIONS_INTERFACE.test(
        'export interface VideosRouteOptions {\n  videoService: VideoService;\n}'
      )
    ).toBe(true);
  });

  it('finds the route modules it guards', () => {
    expect(routeModules().length).toBeGreaterThanOrEqual(14);
  });

  it('exports a plugin from every route module and carries no options interface', () => {
    const offenders = routeModules().filter(
      (file) => !pluginName(read(file)) || OPTIONS_INTERFACE.test(read(file))
    );

    expect(offenders).toEqual([]);
  });

  it('registers every route plugin from the table in routes/index.ts', () => {
    const table = read(`${ROUTES_DIR}index.ts`);
    const missing = routeModules()
      .map((file) => pluginName(read(file)) as string)
      .filter((name) => !new RegExp(`[\\s[]${name}[,\\]]`).test(table));

    expect(missing).toEqual([]);
  });
});
