import { readdirSync } from 'node:fs';
import type { Token } from 'markdown-it';
import { markdownDocument, parseMarkdown } from './markdown';
import { ROOT } from './repo-files';

const SECTION = '6. Verification & Enforcement';

function codeIn(inline: Token | undefined): string[] {
  return (inline?.children ?? [])
    .filter((child) => child.type === 'code_inline')
    .map((child) => child.content);
}

/** The code span opening the first cell of each body row of every table under the section heading. */
function listedAssertions(tokens: readonly Token[]): string[] {
  const listed: string[] = [];
  let section = '';
  let inBody = false;
  let firstCell = false;
  for (const [index, token] of tokens.entries()) {
    const next = tokens[index + 1];
    if (token.type === 'heading_open' && token.tag === 'h2') section = next?.content ?? '';
    if (token.type === 'tbody_open') inBody = true;
    if (token.type === 'tbody_close') inBody = false;
    if (token.type === 'tr_open') firstCell = true;
    if (token.type === 'td_open' && firstCell && inBody && section === SECTION) {
      firstCell = false;
      const [assertion] = codeIn(next);
      if (assertion !== undefined) listed.push(assertion);
    }
  }
  return listed;
}

function architectureSpecs(): string[] {
  return readdirSync(`${ROOT}/tests/architecture`).filter((file) => file.endsWith('.test.ts'));
}

describe('architecture: architecture-table', () => {
  it('reads the first cell of each row under section 6, and only there', () => {
    const fixture = parseMarkdown(
      [
        '## 5. Architectural Invariants',
        '| Assertion | Holds |',
        '|---|---|',
        '| `elsewhere.test.ts` | not listed |',
        `## ${SECTION}`,
        '| Assertion | Holds |',
        '|---|---|',
        '| `zero-matches.test.ts` | counts, `not-this.test.ts` |',
        '| `tests/in-process/start-order.test.ts` | consumers start last |',
      ].join('\n')
    );

    expect(listedAssertions(fixture.tokens)).toEqual([
      'zero-matches.test.ts',
      'tests/in-process/start-order.test.ts',
    ]);
  });

  it('lists exactly the assertions in tests/architecture', () => {
    const listed = listedAssertions(markdownDocument('ARCHITECTURE.md').tokens).filter(
      (assertion) => !assertion.includes('/')
    );

    expect([...listed].sort()).toEqual(architectureSpecs().sort());
  });
});
