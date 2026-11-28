import type { ChannelPageView } from '@vp/api-contracts';
import { renderPage } from '@vp/web-testing/server';
import {
  BACKGROUND_IMAGE,
  IMAGE_URLS,
  PRESENTATION,
  contentSection,
} from '#app/__tests__/channel-page-fixtures';
import { AppProviders, withToasts } from '#app/__tests__/providers';
import { PageSection } from '../page-section';

type Section = ChannelPageView['tab']['sections'][number];

const renderSection = (section: Section, images: ChannelPageView['images'] = {}) =>
  renderPage(
    <PageSection section={section} handle="creator" images={images} />,
    withToasts(AppProviders)
  );

describe('apps/client/web: PageSection', () => {
  it('titles a content section, lays it out as chosen and links its See all to the tab', async () => {
    const markup = await renderSection(
      contentSection({ layout: { type: 'list' }, seeAll: 'videos' })
    );

    expect(markup).toContain('>Season one</h2>');
    expect(markup).toContain('data-layout="list"');
    expect(markup).toContain('href="/channels/creator/videos"');
  });

  it('scopes the accent to the section and draws the backdrop only for an image that is ready', async () => {
    const accented = contentSection({
      presentation: { ...PRESENTATION, accent: '#cc3366', background: BACKGROUND_IMAGE },
    });

    const ready = await renderSection(accented, { [BACKGROUND_IMAGE]: IMAGE_URLS });
    const missing = await renderSection(accented);
    const plain = await renderSection(contentSection());

    expect(ready).toContain('data-brand=');
    expect(ready).toContain('data-slot="section-backdrop"');
    expect(missing).not.toContain('data-slot="section-backdrop"');
    expect(plain).not.toContain('data-brand=');
  });

  it('draws the links of a links section with their platform, and only the https ones', async () => {
    const markup = await renderSection({
      kind: 'links',
      id: 'links',
      presentation: { ...PRESENTATION, title: null },
      links: [
        { label: 'Shop', url: 'https://example.com/shop', platform: 'website' },
        { label: 'Bad', url: 'javascript:alert(1)', platform: 'website' },
      ],
    });

    expect(markup).toContain('href="https://example.com/shop"');
    expect(markup).toContain('rel="nofollow noopener ugc"');
    expect(markup).not.toContain('javascript:');
  });
});
