import { contextFor } from '../../__tests__/fixtures';
import { createIntl } from '../../create-intl';

const FAMILY = '👨‍👩‍👧‍👦';
const CAFE = 'Café';
const TOKYO = '東京都渋谷区';

function cut(text: string, max: number, locale = 'en') {
  const cutText = createIntl(contextFor(locale)).call('truncate', text, { maxGraphemes: max });
  return cutText.ok ? cutText.value : cutText.error.code;
}

describe('@kit/intl: truncate', () => {
  it.each([
    {
      scenario: 'an emoji sequence',
      text: `ab${FAMILY}${FAMILY}${FAMILY}`,
      max: 4,
      expected: `ab${FAMILY}…`,
    },
    { scenario: 'a combining mark', text: `${CAFE} au lait`, max: 5, expected: `${CAFE}…` },
    { scenario: 'a CJK string', text: TOKYO, max: 4, expected: '東京都…', locale: 'ja' },
  ])('keeps $scenario whole', ({ text, max, expected, locale }) => {
    expect(cut(text, max, locale)).toBe(expected);
  });

  it.each([
    { scenario: 'an emoji sequence', text: `ab${FAMILY}${FAMILY}${FAMILY}`, max: 4 },
    { scenario: 'a combining mark', text: `${CAFE} au lait`, max: 5 },
  ])('fixes what a UTF-16 substring breaks in $scenario', ({ text, max }) => {
    const graphemeSafe = cut(text, max);
    const codeUnitCut = text.substring(0, max - 1);

    expect(graphemeSafe.startsWith(codeUnitCut)).toBe(true);
    expect(graphemeSafe).not.toBe(`${codeUnitCut}…`);
  });

  it('leaves text that already fits alone', () => {
    expect(cut(CAFE, 4)).toBe(CAFE);
  });

  it.each([0, 1.5])('declines a limit of %d', (max) => {
    expect(cut('text', max)).toBe('FORMAT_UNRENDERABLE');
  });

  it.each([
    { options: { maxGraphemes: 8, ellipsis: '...' }, text: 'abcdefghijkl', expected: 'abcde...' },
    {
      options: { maxGraphemes: 9, position: 'middle' },
      text: 'holiday-photo-final.png',
      expected: 'holi….png',
    },
    {
      options: { maxGraphemes: 9, boundary: 'word' },
      text: 'Hello wonderful world',
      expected: 'Hello…',
    },
    {
      options: { maxGraphemes: 12, position: 'middle', boundary: 'word' },
      text: 'Hello wonderful world',
      expected: 'Hello…world',
    },
    { options: { maxGraphemes: 1, ellipsis: '...' }, text: 'abc', expected: 'FORMAT_UNRENDERABLE' },
  ] as const)('takes $options', ({ options, text, expected }) => {
    const cutText = createIntl(contextFor('en')).call('truncate', text, options);

    expect(cutText.ok ? cutText.value : cutText.error.code).toBe(expected);
  });
});
