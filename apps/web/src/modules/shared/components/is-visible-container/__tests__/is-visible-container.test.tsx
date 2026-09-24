import { renderToStaticMarkup } from 'react-dom/server';
import { IsVisibleContainer, whenIntersecting } from '../is-visible-container';

describe('apps/web: is visible container', () => {
  it('renders its children', () => {
    const markup = renderToStaticMarkup(
      <IsVisibleContainer>
        <span>next page</span>
      </IsVisibleContainer>
    );

    expect(markup).toContain('next page');
  });

  it.each([
    { isIntersecting: true, called: 1 },
    { isIntersecting: false, called: 0 },
  ])('reports the container in view when intersecting=$isIntersecting', ({ isIntersecting, called }) => {
    const onVisible = vi.fn();

    whenIntersecting(onVisible)([{ isIntersecting }]);

    expect(onVisible).toHaveBeenCalledTimes(called);
  });
});
