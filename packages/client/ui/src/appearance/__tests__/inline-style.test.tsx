import { renderToStaticMarkup } from 'react-dom/server';
import { InlineStyle } from '../inline-style';

describe('@vp/ui: InlineStyle', () => {
  it.each([
    { nonce: 'n0nce', tag: '<style nonce="n0nce">' },
    { nonce: undefined, tag: '<style>' },
  ])('writes the CSS unescaped under nonce $nonce', ({ nonce, tag }) => {
    const css = '[data-brand="3366cc"] > a { --accent: #3366CC; }';

    expect(renderToStaticMarkup(<InlineStyle css={css} nonce={nonce} />)).toBe(
      `${tag}${css}</style>`
    );
  });
});
