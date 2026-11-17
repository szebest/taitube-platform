import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { REPO } from './ui-tree';

const FIXTURE = 'packages/platform/universal/design-tokens/src/__tests__/fixtures/tokens.json';
const DOCUMENT = 'docs/design/tokens.json';

describe('scripts: the design-tokens spec fixture', () => {
  it(`is a copy of ${DOCUMENT}`, () => {
    expect(readFileSync(join(REPO, FIXTURE), 'utf8')).toBe(
      readFileSync(join(REPO, DOCUMENT), 'utf8')
    );
  });
});
