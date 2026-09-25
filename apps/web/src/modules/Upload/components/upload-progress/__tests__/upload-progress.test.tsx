import { createApiStore } from '../../../../../__tests__/api-store';
import { renderPage } from '../../../../../__tests__/render-page';
import { uploadsApi } from '../../../api/uploads-api';
import { UploadProgress } from '../upload-progress';

describe('apps/web: upload progress', () => {
  it('reads 0% before any bytes are sent', async () => {
    expect(await renderPage(<UploadProgress />)).toContain('Progress: 0%');
  });

  it('shows the transfer progress rounded to a whole percent', async () => {
    const store = createApiStore();
    await store.dispatch(uploadsApi.endpoints.uploadProgress.initiate());
    store.dispatch(uploadsApi.util.updateQueryData('uploadProgress', undefined, () => 42.6));

    const markup = await renderPage(<UploadProgress />, { store });

    expect(markup).toContain('Progress: 43%');
    expect(markup).toContain('aria-valuenow="42.6"');
  });
});
