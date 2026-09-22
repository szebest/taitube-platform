import { productionSources, read } from './repo-files';

const COMPARISONS = [
  /constructor\s*\.\s*name\s*[!=]=+\s*['"`]/,
  /['"`]\s*[!=]=+\s*[\w$.?]*\.constructor\s*\.\s*name/,
];

function infersFromClassName(source: string): boolean {
  return COMPARISONS.some((pattern) => pattern.test(source));
}

describe('architecture: a class identity is instanceof, never its name', () => {
  it.each([
    { scenario: 'a direct comparison', line: "queue.constructor.name === 'InMemoryJobQueue'" },
    { scenario: 'an optional chain', line: "queue?.constructor.name !== 'InMemoryJobQueue'" },
    { scenario: 'the literal on the left', line: "'InMemoryJobQueue' === queue.constructor.name" },
  ])('still recognises $scenario', ({ line }) => {
    expect(infersFromClassName(line)).toBe(true);
  });

  it.each([
    { scenario: 'naming an error after its class', line: 'this.name = this.constructor.name;' },
    { scenario: 'an instanceof check', line: "queue instanceof InMemoryJobQueue || name === 'x'" },
  ])('leaves $scenario alone', ({ line }) => {
    expect(infersFromClassName(line)).toBe(false);
  });

  it('picks no adapter family out of a class name in any production source', () => {
    const offenders = productionSources().filter((file) => infersFromClassName(read(file)));

    expect(offenders).toEqual([]);
  });
});
