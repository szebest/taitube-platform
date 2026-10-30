import { render } from '@testing-library/react';

import { MatchedText } from '../matched-text';

const marks = (container: HTMLElement) =>
  [...container.querySelectorAll('mark')].map((mark) => mark.textContent);

describe('apps/client/web: MatchedText', () => {
  it.each([
    {
      scenario: 'every term, whatever its case',
      text: 'Cats and DOGS',
      terms: ['cats', 'dogs'],
      marked: ['Cats', 'DOGS'],
    },
    { scenario: 'nothing without a match', text: 'Birds', terms: ['cats'], marked: [] },
    { scenario: 'nothing without terms', text: 'Cats', terms: [], marked: [] },
    {
      scenario: 'a term of regular expression syntax, literally',
      text: 'a+b ab',
      terms: ['a+b'],
      marked: ['a+b'],
    },
  ])('marks $scenario', ({ text, terms, marked }) => {
    const { container } = render(<MatchedText text={text} terms={terms} />);

    expect(marks(container)).toEqual(marked);
    expect(container).toHaveTextContent(text);
  });

  it('never turns the text into markup', () => {
    const { container } = render(
      <MatchedText text={'<img src=x onerror=alert(1)> cats'} terms={['cats']} />
    );

    expect(container.querySelector('img')).toBeNull();
    expect(container).toHaveTextContent('<img src=x onerror=alert(1)> cats');
  });
});
