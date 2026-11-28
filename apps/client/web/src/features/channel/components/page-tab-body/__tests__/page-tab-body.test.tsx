import { channel } from '@vp/web-testing';
import { renderPage } from '@vp/web-testing/server';
import {
  HEADER_IMAGE,
  IMAGE_URLS,
  channelPageView,
  contentSection,
  tabSummary,
} from '#app/__tests__/channel-page-fixtures';
import { AppProviders, withToasts } from '#app/__tests__/providers';
import { PageTabBody } from '../page-tab-body';

const SHOWS = tabSummary({ id: 'shows', kind: 'custom', title: 'Shows', slug: 'shows' });

const renderBody = (page: ReturnType<typeof channelPageView>) =>
  renderPage(<PageTabBody channel={channel()} page={page} />, withToasts(AppProviders));

describe('apps/client/web: PageTabBody', () => {
  it('puts a custom tab description and header image over its sections', async () => {
    const markup = await renderBody(
      channelPageView(
        {
          ...SHOWS,
          description: 'Every show we film',
          header: HEADER_IMAGE,
          sections: [contentSection()],
        },
        { images: { [HEADER_IMAGE]: IMAGE_URLS } }
      )
    );

    expect(markup).toContain(`src="${IMAGE_URLS.w1280}"`);
    expect(markup.indexOf('Every show we film')).toBeLessThan(markup.indexOf('Season one'));
  });

  it('says there is nothing yet for a tab with no sections', async () => {
    const markup = await renderBody(channelPageView({ ...SHOWS, sections: [] }));

    expect(markup).toContain('Nothing here yet');
  });
});
