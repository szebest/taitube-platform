import { load, loadAll } from 'js-yaml';
import { pruneLockfile, unlockedPackages, withoutTarballIntegrity } from '../lockfile';

const REPO_LOCKFILE = `---
lockfileVersion: '9.0'
importers:
  .:
    packageManagerDependencies: {}
---
lockfileVersion: '9.0'
importers:
  .:
    devDependencies: { turbo: { specifier: ^2, version: 2.1.0 } }
  packages/platform/universal/result: {}
  packages/server/db: {}
packages:
  turbo@2.1.0: { resolution: { integrity: sha512-a } }
  zod@4.6.5: { resolution: { integrity: sha512-b } }
`;

describe('scripts: extractable lockfile', () => {
  it('keeps the closure importers and an empty root, and leaves the pnpm document alone', () => {
    const [pnpm, main] = loadAll(
      pruneLockfile(REPO_LOCKFILE, ['packages/platform/universal/result'])
    ) as {
      importers: object;
    }[];

    expect(pnpm?.importers).toEqual({ '.': { packageManagerDependencies: {} } });
    expect(main?.importers).toEqual({ '.': {}, 'packages/platform/universal/result': {} });
  });

  it('drops the integrity of a local tarball only', () => {
    const app = `packages:
  '@kit/di@file:tarballs/kit-di.tgz': { resolution: { integrity: sha512-x, tarball: 'file:tarballs/kit-di.tgz' } }
  zod@4.6.5: { resolution: { integrity: sha512-b } }
`;

    expect(load(withoutTarballIntegrity(app).replace(/^---\n/, '')) as object).toEqual({
      packages: {
        '@kit/di@file:tarballs/kit-di.tgz': { resolution: { tarball: 'file:tarballs/kit-di.tgz' } },
        'zod@4.6.5': { resolution: { integrity: 'sha512-b' } },
      },
    });
  });

  it('names a package the app locks and the repository does not, tarballs aside', () => {
    const app = `packages:
  '@kit/di@file:tarballs/kit-di.tgz': {}
  zod@4.6.5: {}
  zod@4.7.0: {}
`;

    expect(unlockedPackages(app, REPO_LOCKFILE)).toEqual(['zod@4.7.0']);
  });
});
