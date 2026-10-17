import { renderPage } from '@vp/web-testing/server';

import { AppProviders } from '#app/__tests__/providers';
import { UploadProgress } from '../upload-progress';

function renderUploadProgress(percent: number): Promise<string> {
  return renderPage(<UploadProgress percent={percent} />, AppProviders);
}

describe('apps/client/studio: upload progress', () => {
  it.each([
    { percent: 0, label: 'Progress: 0%' },
    { percent: 42.6, label: 'Progress: 43%' },
  ])('reads $label for $percent percent sent', async ({ percent, label }) => {
    const markup = await renderUploadProgress(percent);

    expect(markup).toContain(label);
    expect(markup).toContain(`aria-valuenow="${percent}"`);
  });
});
