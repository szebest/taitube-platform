import { OWNER_ID, VIDEO_ID } from '@vp/web-testing';

import { renderPage } from '@vp/web-testing/server';

import { AppProviders } from '#app/__tests__/providers';
import { VideoSettingsDropdown } from '../video-settings-dropdown';

describe('apps/client/web: video settings dropdown', () => {
  it('offers the video actions behind a closed toggle', async () => {
    const markup = await renderPage(
      <VideoSettingsDropdown video={{ id: VIDEO_ID, ownerId: OWNER_ID }} />,
      AppProviders
    );

    expect(markup).toContain('aria-label="video actions"');
    expect(markup).toContain('aria-expanded="false"');
  });
});
