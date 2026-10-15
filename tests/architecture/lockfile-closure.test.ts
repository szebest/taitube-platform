import { clientApps } from './client-apps';
import { workspaceClosure } from './workspace-closure';

const SERVER_TIER = 'packages/server/';

describe('architecture: resolved workspace closures', () => {
  it('still reads the workspace links the lockfile records', () => {
    expect(workspaceClosure('apps/client/web', 'runtime')).toContain(
      'packages/universal/api-contracts'
    );
    expect(workspaceClosure('apps/server/api', 'runtime')).toContain('packages/server/adapters');
  });

  it.each(clientApps())('keeps every server-tier package out of the closure of %s', (app) => {
    const server = workspaceClosure(app, 'runtime').filter((dep) => dep.startsWith(SERVER_TIER));

    expect(server).toEqual([]);
  });

  it.each(clientApps())(
    'keeps them out of %s once devDependencies count too, build tooling aside',
    (app) => {
      const server = workspaceClosure(app, 'dev').filter((dep) => dep.startsWith(SERVER_TIER));

      expect(server).toEqual([]);
    }
  );

  it('exempts nothing but the build tooling, which ships no code', () => {
    expect(workspaceClosure('packages/universal/domain', 'dev')).toEqual([]);
  });
});
