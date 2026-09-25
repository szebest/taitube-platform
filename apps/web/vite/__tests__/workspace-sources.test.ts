import { fileURLToPath } from 'node:url';
import { workspaceSourceAliases } from '../workspace-sources';

const PACKAGES = fileURLToPath(new URL('../../../../packages', import.meta.url));

function replacementFor(name: string): string | undefined {
  const alias = workspaceSourceAliases(PACKAGES).find(({ find }) =>
    find instanceof RegExp ? find.test(name) : find === name
  );
  return alias?.replacement;
}

describe('apps/web: workspace source aliases', () => {
  it.each([
    { name: '@vp/intl-react', source: 'packages/client/intl-react/src/index.ts' },
    { name: '@vp/api-client', source: 'packages/client/api-client/src/index.ts' },
    { name: '@vp/result', source: 'packages/universal/result/src/index.ts' },
  ])('resolves $name to its source', ({ name, source }) => {
    expect(replacementFor(name)?.endsWith(source)).toBe(true);
  });

  it.each(['@vp/api-contracts/openapi', '@vp/adapters', '@vp/core'])(
    'leaves %s to the package exports',
    (name) => {
      expect(replacementFor(name)).toBeUndefined();
    }
  );
});
