import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { CAUSES, causeOf, renderCauses, UNCLASSIFIED } from '../causes';

const fixture = (cause: string): string =>
  readFileSync(
    join(import.meta.dirname, 'fixtures/causes', `${cause.replaceAll(' ', '-')}.log`),
    'utf8'
  );

describe('causeOf', () => {
  it.each(CAUSES.map(({ cause }) => cause))('names the fixture log of %s by its rule', (cause) => {
    expect(causeOf(fixture(cause))).toBe(cause);
  });

  it('reads through the ANSI colours and the timestamps of a raw GitHub log', () => {
    const raw =
      '2026-10-31T13:08:14.2130664Z   1 failed\n2026-10-31T13:08:14.2131397Z     \x1b[31m[chromium] › e2e/start-here.test.ts:6:3\x1b[39m';

    expect(causeOf(raw)).toBe('e2e spec');
  });

  it('leaves a log no rule knows unclassified', () => {
    expect(causeOf('##[error]Process completed with exit code 1.')).toBe(UNCLASSIFIED);
  });
});

describe('renderCauses', () => {
  it('lists the causes by count, with their share and whether they are instability', () => {
    const rendered = renderCauses([
      { cause: 'knip', jobs: 1, flipped: 0 },
      { cause: 'budget', jobs: 3, flipped: 2 },
    ]);

    expect(rendered.indexOf('budget')).toBeLessThan(rendered.indexOf('knip'));
    expect(rendered).toContain('| budget | 3 | 75.0% | 2 | yes |');
  });
});
