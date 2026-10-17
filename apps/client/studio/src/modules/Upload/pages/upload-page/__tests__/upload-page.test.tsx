import { renderPage } from '@vp/web-testing/server';

import { AppProviders } from '#app/__tests__/providers';
import { UploadPage } from '../upload-page';

function renderUploadPage(): Promise<string> {
  return renderPage(<UploadPage />, AppProviders);
}

describe('apps/client/studio: upload page', () => {
  it('opens a blank upload form', async () => {
    const markup = await renderUploadPage();

    expect(markup).toContain('click to select video file');
    expect(markup).toContain('>Upload</button>');
    expect(markup).not.toContain('Submit another video');
  });
});
