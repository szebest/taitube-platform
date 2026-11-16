import { packageDir } from '../../scripts/workspace-packages';
import { read, trackedFiles } from './repo-files';

const PAGINATION = packageDir('@vp/pagination');

const BARRELS = [
  'packages/server/core/ports',
  'packages/server/core/repositories',
  'packages/universal/domain/src',
  `${PAGINATION}/src`,
];
const RE_EXPORT = /export\s+\*\s+from\s+['"]([^'"]+)['"]/g;

describe('architecture: core barrels and port file names', () => {
  it.each(BARRELS.map((folder) => ({ folder })))(
    'keeps the $folder barrel inside its own folder',
    ({ folder }) => {
      const reached = [...read(`${folder}/index.ts`).matchAll(RE_EXPORT)]
        .map((match) => match[1] as string)
        .filter((specifier) => !specifier.startsWith('./'));

      expect(reached).toEqual([]);
    }
  );

  it('spells every port file without a .port suffix', () => {
    expect(trackedFiles('apps', 'packages').filter((file) => file.endsWith('.port.ts'))).toEqual(
      []
    );
  });
});
