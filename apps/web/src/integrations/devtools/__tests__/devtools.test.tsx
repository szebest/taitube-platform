import { renderPage } from '../../../__tests__/render-page';
import Devtools from '../devtools';

describe('apps/web: devtools', () => {
  it('renders nothing outside the development build, even when mounted', async () => {
    expect(await renderPage(<Devtools />)).toBe('');
  });
});
