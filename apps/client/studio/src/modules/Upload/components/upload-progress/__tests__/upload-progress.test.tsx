import { renderPage } from '@vp/web-testing/server';

import { AppProviders } from '#app/__tests__/providers';
import { UploadProgress } from '../upload-progress';

describe('apps/client/studio: upload progress', () => {
  it.each([
    { percent: 0, label: 'Progress: 0%' },
    { percent: 42.6, label: 'Progress: 43%' },
  ])('reads $label for $percent percent sent', async ({ percent, label }) => {
    const markup = await renderPage(<UploadProgress percent={percent} />, AppProviders);

    expect(markup).toContain(label);
    expect(markup).toContain(`aria-valuenow="${percent}"`);
  });
});
