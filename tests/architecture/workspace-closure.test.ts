import { workspaceClosure, workspaceLinks } from './workspace-closure';

const PLANTED = `lockfileVersion: '9.0'

importers:

  apps/web:
    dependencies:
      '@vp/api-contracts':
        specifier: workspace:*
        version: link:../../packages/universal/api-contracts
      '@vp/testing':
        specifier: workspace:*
        version: link:../../packages/server/testing
    devDependencies:
      '@vp/tsconfig':
        specifier: workspace:*
        version: link:../../packages/universal/tsconfig

  packages/server/testing:
    dependencies:
      '@vp/job-contracts':
        specifier: workspace:*
        version: link:../job-contracts

packages: {}
`;

describe('architecture: workspace closure', () => {
  it('reads a link out of every dependency group the lockfile records', () => {
    expect(workspaceLinks('runtime', PLANTED).get('apps/web')).toEqual([
      { path: 'packages/universal/api-contracts', dev: false },
      { path: 'packages/server/testing', dev: false },
    ]);
  });

  it.each([{ group: 'runtime' as const }, { group: 'dev' as const }])(
    'follows a runtime edge onto build tooling in the $group closure',
    ({ group }) => {
      expect(workspaceClosure('apps/web', group, PLANTED)).toContain('packages/server/testing');
    }
  );

  it('follows what that runtime edge drags in behind it', () => {
    expect(workspaceClosure('apps/web', 'runtime', PLANTED)).toContain(
      'packages/server/job-contracts'
    );
  });

  it('still exempts build tooling reached by a dev edge', () => {
    expect(workspaceClosure('apps/web', 'dev', PLANTED)).not.toContain(
      'packages/universal/tsconfig'
    );
  });

  it('fires the server-tier assertion the planted edge breaks', () => {
    const server = workspaceClosure('apps/web', 'runtime', PLANTED).filter((dep) =>
      dep.startsWith('packages/server/')
    );

    expect(server).toEqual(['packages/server/job-contracts', 'packages/server/testing']);
  });
});
