import { contextFor } from '../../__tests__/fixtures';
import { truncate } from '../truncate';

const FAMILY = '👨‍👩‍👧‍👦';
const CAFE = 'Café';
const TOKYO = '東京都渋谷区';

function cut(text: string, max: number, locale = 'en') {
  const cutText = truncate(text, max, contextFor(locale));
  return cutText.ok ? cutText.value : cutText.error.code;
}

describe('@vp/intl: truncate', () => {
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
});
