import type { Translator } from '@kit/i18n';
import { unrenderable } from '@kit/intl';
import { err, map, ok } from '@kit/result';
import { ErrorCodes } from '@vp/errors';
import type { SharedCatalogue } from '@vp/shared-messages';
import { FailureWords } from '../failure-words';

function translator(words: string | null): Translator<SharedCatalogue> {
  const rendered = words === null ? err(unrenderable('t', 'no copy')) : ok(words);
  return {
    t: () => rendered,
    parts: () => map(rendered, (text) => [{ type: 'text', text }]),
    tOr: (_key, _args, fallback) => words ?? fallback,
    partsOr: (_key, _args, fallback) =>
      words === null ? fallback : [{ type: 'text', text: words }],
  };
}

const words = new FailureWords(
  new Map([
    ['pl', translator('Nie wolno.')],
    ['en', translator('Not allowed here.')],
    ['sv', translator(null)],
  ])
);
const forbidden = { code: ErrorCodes.FORBIDDEN, message: 'Forbidden v1' };

describe('apps/server/api/services: FailureWords', () => {
  it.each([
    {
      scenario: 'the first locale with a translator',
      failure: forbidden,
      chain: ['de', 'pl', 'en'],
      expected: 'Nie wolno.',
    },
    {
      scenario: 'the source when no other locale has one',
      failure: forbidden,
      chain: ['de', 'en'],
      expected: 'Not allowed here.',
    },
    {
      scenario: 'the message when no locale has one',
      failure: forbidden,
      chain: ['de'],
      expected: 'Forbidden v1',
    },
    {
      scenario: 'the message for a code without copy',
      failure: { code: 'NOT_A_CODE', message: 'raw' },
      chain: ['pl'],
      expected: 'raw',
    },
    {
      scenario: 'the message when the copy does not render',
      failure: forbidden,
      chain: ['sv', 'en'],
      expected: 'Forbidden v1',
    },
  ])('renders $scenario', ({ failure, chain, expected }) => {
    expect(words.detail(failure, chain)).toBe(expected);
  });
});
