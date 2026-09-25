import { renderToStaticMarkup } from 'react-dom/server';
import { LoadingSpinner } from '../loading-spinner';

describe('apps/web: loading spinner', () => {
  it('announces itself as a loading status', () => {
    const markup = renderToStaticMarkup(<LoadingSpinner />);

    expect(markup).toContain('<output');
    expect(markup).toContain('aria-label="Loading"');
  });
});
