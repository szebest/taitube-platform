import { renderPage } from '#app/__tests__/render-page';
import { UploadPage } from '../upload-page';

describe('apps/web: upload page', () => {
  it('opens a blank upload form', async () => {
    const markup = await renderPage(<UploadPage />);

    expect(markup).toContain('click to select video file');
    expect(markup).toContain('>Upload</button>');
    expect(markup).not.toContain('Submit another video');
  });
});
