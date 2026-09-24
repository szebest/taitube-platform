import { renderToStaticMarkup } from 'react-dom/server';
import { IsVisibleContainer } from '../is-visible-container';

describe('apps/web: is visible container', () => {
  it('renders its children', () => {
    const markup = renderToStaticMarkup(
      <IsVisibleContainer>
        <span>next page</span>
      </IsVisibleContainer>
    );

    expect(markup).toContain('next page');
  });
});
