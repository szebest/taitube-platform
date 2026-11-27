import { productionSources, read } from './repo-files';

const CONTRACTS = 'packages/universal/api-contracts/src/';

/** Only a watch party contract may accept a party credential; everywhere else it is ignored. */
const WATCH_PARTY_CONTRACT =
  /^packages\/universal\/api-contracts\/src\/watch-part(?:y|ies)[\w-]*\.ts$/;

const OPTS_IN = /\bpartyGuest\s*:\s*true\b/;

function offenders(files: readonly string[], source: (file: string) => string): string[] {
  return files
    .filter((file) => file.startsWith(CONTRACTS) && !WATCH_PARTY_CONTRACT.test(file))
    .filter((file) => OPTS_IN.test(source(file)));
}

describe('architecture: a party credential is accepted only by the watch party contracts', () => {
  it.each([
    { file: `${CONTRACTS}watch-parties.ts`, flagged: false },
    { file: `${CONTRACTS}watch-party-roles.ts`, flagged: false },
    { file: `${CONTRACTS}me.ts`, flagged: true },
  ])('treats partyGuest: true in $file as flagged: $flagged', ({ file, flagged }) => {
    const found = offenders([file], () => 'export const x = defineEndpoint({ partyGuest: true });');

    expect(found.length > 0).toBe(flagged);
  });

  it('finds no partyGuest route outside the watch party contracts', () => {
    expect(offenders(productionSources(), read)).toEqual([]);
  });
});
