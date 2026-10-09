import { workspaceClosure } from './workspace-closure';

const SERVER_TIER = 'packages/server/';

describe('architecture: resolved workspace closures', () => {
  it('still reads the workspace links the lockfile records', () => {
    expect(workspaceClosure('apps/client/web', 'runtime')).toContain(
      'packages/universal/api-contracts'
    );
    expect(workspaceClosure('apps/server/api', 'runtime')).toContain('packages/server/adapters');
  });

  it('keeps every server-tier package out of the frontend closure', () => {
    const server = workspaceClosure('apps/client/web', 'runtime').filter((dep) =>
      dep.startsWith(SERVER_TIER)
    );

    expect(server).toEqual([]);
  });

  it('keeps them out once devDependencies count too, build tooling aside', () => {
    const server = workspaceClosure('apps/client/web', 'dev').filter((dep) =>
      dep.startsWith(SERVER_TIER)
    );

    expect(server).toEqual([]);
  });

  it('exempts nothing but the two packages that ship no code', () => {
    expect(workspaceClosure('packages/universal/domain', 'dev')).toEqual([]);
  });
});
