import { readFile } from 'node:fs/promises';
import { SCENARIOS } from '..';
import { parseContractRoutes } from '../../openapi-routes';

describe('seed/scenarios: SCENARIOS', () => {
  it('names each scenario once, identities and channels first, and only those two essential', () => {
    const names = SCENARIOS.map((scenario) => scenario.name);

    expect(new Set(names).size).toBe(names.length);
    expect(names.slice(0, 3)).toEqual(['identities', 'categories', 'channels']);
    expect(SCENARIOS.filter((scenario) => scenario.essential).map((s) => s.name)).toEqual([
      'identities',
      'channels',
    ]);
  });

  it('requires only routes the committed contract lists today', async () => {
    const document = await readFile(
      new URL('../../../../../../universal/api-contracts/openapi.yaml', import.meta.url),
      'utf8'
    );
    const routes = parseContractRoutes(document);

    const unknown = SCENARIOS.flatMap((scenario) =>
      scenario.requires
        .filter((route) => !routes.has(route))
        .map((route) => `${scenario.name}: ${route}`)
    );

    expect(unknown).toEqual([]);
  });
});
