import { VIDEO_ID } from '../../../../../__tests__/fixtures';
import { renderPage } from '../../../../../__tests__/render-page';
import { VideoSettingsDropdown } from '../video-settings-dropdown';

describe('apps/web: video settings dropdown', () => {
  it('offers the video actions behind a closed toggle', async () => {
    const markup = await renderPage(<VideoSettingsDropdown video={{ id: VIDEO_ID }} />);

    expect(markup).toContain('aria-label="video actions"');
    expect(markup).toContain('aria-expanded="false"');
  });
});
