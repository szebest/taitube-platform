import { contextFor } from '../../__tests__/fixtures';
import { type ListOptions, list } from '../list';

const GENRES = ['Action', 'Comedy', 'Drama'];

function render(locale: string, options?: ListOptions) {
  const rendered = list({ type: 'list', value: GENRES, options }, contextFor(locale));
  return rendered.ok ? rendered.value : rendered.error.code;
}

describe('@vp/intl: list', () => {
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
});
