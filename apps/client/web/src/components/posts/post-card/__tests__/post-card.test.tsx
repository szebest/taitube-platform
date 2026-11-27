import { renderPage } from '@vp/web-testing/server';
import { AppProviders } from '#app/__tests__/providers';
import { PostCard } from '..';

const CHANNEL_ID = '0190c3a0-5e1d-7000-8000-00000000c001';

const render = (children: React.ReactNode) =>
  renderPage(<PostCard.Root channelName="The Creator">{children}</PostCard.Root>, AppProviders);

describe('apps/client/web: PostCard', () => {
  it('names the article by its channel', async () => {
    expect(await render(null)).toContain('aria-label="Post by The Creator"');
  });

  it('links the channel and stamps the time in the header', async () => {
    const markup = await render(
      <PostCard.Header
        channelId={CHANNEL_ID}
        name="The Creator"
        time="2 days ago"
        dateTime="2026-10-14T09:12:00.000Z"
      />
    );

    expect(markup).toContain(`href="/channel/${CHANNEL_ID}"`);
    expect(markup).toContain('<time dateTime="2026-10-14T09:12:00.000Z"');
    expect(markup).toContain('2 days ago');
  });

  it.each([
    { part: <PostCard.Pinned />, shown: 'Pinned' },
    { part: <PostCard.Edited />, shown: '(edited)' },
  ])('shows $shown beside the time', async ({ part, shown }) => {
    const markup = await render(
      <PostCard.Header channelId={CHANNEL_ID} name="The Creator" time="now" dateTime="2026-10-14">
        {part}
      </PostCard.Header>
    );

    expect(markup).toContain(shown);
  });

  it('draws an https link with the attributes of user content, and nothing else as markup', async () => {
    const markup = await render(
      <PostCard.Text text={'See https://example.com/a now <b>bold</b>'} />
    );

    expect(markup).toContain(
      '<a href="https://example.com/a" target="_blank" rel="nofollow noopener ugc"'
    );
    expect(markup).toContain('&lt;b&gt;bold&lt;/b&gt;');
  });

  it('serves every image at both widths with its alt text', async () => {
    const markup = await render(
      <PostCard.Media
        images={[
          {
            alt: 'A tram',
            urls: { w640: 'https://cdn.test/a-640.webp', w1280: 'https://cdn.test/a-1280.webp' },
          },
          {
            alt: 'A stop',
            urls: { w640: 'https://cdn.test/b-640.webp', w1280: 'https://cdn.test/b-1280.webp' },
          },
        ]}
      />
    );

    expect(markup).toContain(
      'srcSet="https://cdn.test/a-640.webp 640w, https://cdn.test/a-1280.webp 1280w"'
    );
    expect(markup).toContain('alt="A tram"');
    expect(markup).toContain('data-count="2"');
  });
});
