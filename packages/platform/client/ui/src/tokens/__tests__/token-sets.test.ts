import { readdirSync } from 'node:fs';
import { parseTokenSet, type TokenSet, tokenGroups } from '@vp/design-tokens';
import { expectOk } from '@vp/testing/result';

const folders = readdirSync(new URL('..', import.meta.url), { encoding: 'utf8', recursive: true })
  .map((entry) => /^([^/]+)\/([^/]+)\/index\.ts$/.exec(entry))
  .filter((match) => match !== null)
  .map(([, kebabGroup = '', id = '']) => ({ kebabGroup, id }));

const exportedSets = async ({ kebabGroup, id }: (typeof folders)[number]) => {
  const exports: Record<string, TokenSet> = await import(`../${kebabGroup}/${id}/index.ts`);
  return Object.values(exports);
};

describe('@vp/ui: the token set modules', () => {
  it.each(folders)(
    '$kebabGroup/$id exports one set that parses against its group',
    async (folder) => {
      const sets = await exportedSets(folder);

      expect(sets).toHaveLength(1);
      for (const set of sets) {
        expectOk(parseTokenSet(set.group, set));
      }
    }
  );

  it.each(folders)('$kebabGroup/$id is the set its folder names', async (folder) => {
    const sets = await exportedSets(folder);

    expect(sets.map((set) => ({ path: tokenGroups[set.group].path, id: set.id }))).toEqual([
      { path: folder.kebabGroup, id: folder.id },
    ]);
  });
});
