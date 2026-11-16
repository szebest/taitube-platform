import { dump } from 'js-yaml';
import { parseEnvironment } from '../parse-environment';
import { PRODUCTION } from './fixtures';

describe('parseEnvironment', () => {
  it('returns the typed environment for a valid file', () => {
    const parsed = parseEnvironment('production', dump(PRODUCTION));

    expect(parsed).toEqual({ ok: true, value: PRODUCTION });
  });

  it.each([
    {
      scenario: 'text that is not YAML',
      text: 'a: [',
      dir: 'production',
      expected: 'production: not YAML',
    },
    {
      scenario: 'a file the spec refuses',
      text: 'name: production\n',
      dir: 'production',
      expected: 'production: kind',
    },
    {
      scenario: 'a name that differs from the directory',
      text: dump(PRODUCTION),
      dir: 'prod',
      expected: 'prod: name: production must equal the directory name prod',
    },
  ])('reports $scenario, prefixed with the directory', ({ text, dir, expected }) => {
    const parsed = parseEnvironment(dir, text);

    expect(parsed.ok ? [] : parsed.error.map((line) => line.slice(0, expected.length))).toContain(
      expected
    );
  });
});
