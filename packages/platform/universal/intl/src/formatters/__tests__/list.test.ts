import { contextFor, format } from '../../__tests__/fixtures';
import { createIntl } from '../../create-intl';
import { runParts } from '../../kind';
import { type ListOptions, type MoreBranches, list } from '../list';

const GENRES = ['Action', 'Comedy', 'Drama'];
const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F', 'G'];

const MORE = {
  en: { one: '{?} more', other: '{?} more' },
  pl: { one: '{?} inny', few: '{?} inne', many: '{?} innych', other: '{?} innego' },
  ar: { other: '{?} أخرى' },
} as const satisfies Readonly<Record<string, MoreBranches>>;

function render(locale: string, options?: ListOptions, items: readonly string[] = GENRES) {
  const rendered = format({ type: 'list', value: items, options }, contextFor(locale));
  return rendered.ok ? rendered.value : rendered.error.code;
}

const collapsed = (locale: keyof typeof MORE, max: number) => ({ max, more: MORE[locale] });

describe('@kit/intl: list', () => {
  it.each([
    { locale: 'en', expected: 'Action, Comedy, and Drama' },
    { locale: 'en-GB', expected: 'Action, Comedy and Drama' },
    { locale: 'de', expected: 'Action, Comedy und Drama' },
    { locale: 'ja', expected: 'Action、Comedy、Drama' },
  ])('joins the items the way $locale does', ({ locale, expected }) => {
    expect(render(locale)).toBe(expected);
  });

  it('takes a disjunction', () => {
    expect(render('en-GB', { type: 'disjunction' })).toBe('Action, Comedy or Drama');
  });

  it.each([
    { locale: 'en' as const, total: 4, expected: 'A, B, and 2 more' },
    { locale: 'pl' as const, total: 3, expected: 'A, B i 1 inny' },
    { locale: 'pl' as const, total: 4, expected: 'A, B i 2 inne' },
    { locale: 'pl' as const, total: 7, expected: 'A, B i 5 innych' },
  ])('collapses $total items past max 2 into the $locale branch', ({ locale, total, expected }) => {
    expect(render(locale, collapsed(locale, 2), LETTERS.slice(0, total))).toBe(expected);
  });

  it('collapses through the locale list pattern in ar, whatever isolates the engine adds', () => {
    const rendered = render('ar', collapsed('ar', 2), LETTERS.slice(0, 4));

    expect(rendered.replaceAll(/[\u2066-\u2069]/gu, '')).toMatch(/^A و?B و.+ أخرى$/u);
  });

  it.each([
    { scenario: 'max 0', options: { max: 0 } as const },
    { scenario: 'max at the length', options: { max: 3, more: { other: '{?}' } } },
    { scenario: 'max past the length', options: { max: 9, more: { other: '{?}' } } },
  ])('shows every item with $scenario, and no more copy', ({ options }) => {
    expect(render('en', options)).toBe('Action, Comedy, and Drama');
  });

  it.each([
    { scenario: 'a fractional max', options: { max: 1.5, more: MORE.en } },
    { scenario: 'a negative max', options: { max: -1, more: MORE.en } },
  ])('declines $scenario', ({ options }) => {
    expect(render('en', options)).toBe('FORMAT_UNRENDERABLE');
  });

  it('declines max with no more copy, which also fails to compile', () => {
    // @ts-expect-error a collapsed list needs its more copy
    const options: ListOptions = { max: 1 };

    expect(render('en', options)).toBe('FORMAT_UNRENDERABLE');
  });

  it('formats items of other kinds through the context', () => {
    const prices = format(
      {
        type: 'list',
        value: [1250, { type: 'money', value: 990, options: { units: 'minor' } }],
        options: { item: { kind: 'money', options: { units: 'minor' } } },
      },
      contextFor('en-GB', { currency: 'GBP' })
    );

    expect(prices).toEqual({ ok: true, value: '£12.50 and £9.90' });
  });

  it('returns the structure a UI renders, its text the rendered list', () => {
    const detail = runParts(
      list,
      ['A', 'B', 'C', 'D'],
      { max: 2, more: MORE.en },
      createIntl(contextFor('en')).context
    );

    expect(detail).toEqual({
      ok: true,
      value: {
        segments: [
          { type: 'item', value: 'A' },
          { type: 'literal', value: ', ' },
          { type: 'item', value: 'B' },
          { type: 'literal', value: ', and ' },
          { type: 'more', value: '2 more' },
        ],
        visible: ['A', 'B'],
        hidden: ['C', 'D'],
        total: 4,
        full: 'A, B, C, and D',
        text: 'A, B, and 2 more',
      },
    });
  });
});
