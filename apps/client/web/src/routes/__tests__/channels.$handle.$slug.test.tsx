import { getChannel, listMyMemberships } from '@vp/api-contracts';
import { getChannelPage } from '@vp/api-contracts';
import { ErrorCodes } from '@vp/errors';
import { channel, mockEndpoint, problemReply } from '@vp/web-testing';
import { serverRender } from '@vp/web-testing/server';
import { HttpResponse } from 'msw/http';
import {
  BACKGROUND_IMAGE,
  HEADER_IMAGE,
  IMAGE_URLS,
  INLINE_IMAGE,
  PRESENTATION,
  channelPageApi,
  channelPageView,
  contentSection,
  tabSummary,
} from '#app/__tests__/channel-page-fixtures';
import { loaderApi } from '#app/__tests__/loader-api';
import { getRouter } from '#app/router';

const SHOWS = tabSummary({ id: 'shows', kind: 'custom', title: 'Shows', slug: 'shows' });

const SHOWS_PAGE = channelPageView(
  {
    ...SHOWS,
    description: 'Everything we film, by show',
    header: HEADER_IMAGE,
    sections: [
      contentSection({
        presentation: { ...PRESENTATION, background: BACKGROUND_IMAGE, accent: '#cc3366' },
      }),
      {
        kind: 'rich_text',
        id: 'notes',
        presentation: { ...PRESENTATION, title: null },
        body: `Read the [notes](https://example.com/notes)\n\n![Cast](page-image:${INLINE_IMAGE})\n\n<script>alert(1)</script>`,
      },
    ],
  },
  {
    tabs: [tabSummary(), SHOWS],
    images: {
      [HEADER_IMAGE]: IMAGE_URLS,
      [BACKGROUND_IMAGE]: IMAGE_URLS,
      [INLINE_IMAGE]: IMAGE_URLS,
    },
  }
);

const handlers = (asked: string[] = []) => [
  mockEndpoint(getChannel, () => HttpResponse.json(channel())),
  mockEndpoint(listMyMemberships, () => HttpResponse.json({ items: [] })),
  ...channelPageApi(() => SHOWS_PAGE, asked),
  ...loaderApi(),
];

describe('apps/client/web: /channels/$handle/$slug', () => {
  it('server-renders a custom tab under its header and description with its sections, asking the API for that slug', async () => {
    const asked: string[] = [];

    const { status, main } = await serverRender(getRouter, '/channels/creator/shows', {
      handlers: handlers(asked),
    });

    expect(status).toBe(200);
    expect(asked[0]).toContain('tab=shows');
    expect(main).toContain('Everything we film, by show');
    expect(main).toContain(`src="${IMAGE_URLS.w1280}"`);
    expect(main).toContain('The pilot');
    expect(main).toContain('Season one');
  });

  it('draws the rich text as elements: links nofollow, the image from the creator uploads, no markup', async () => {
    const { main } = await serverRender(getRouter, '/channels/creator/shows', {
      handlers: handlers(),
    });

    expect(main).toContain('rel="nofollow noopener ugc"');
    expect(main).toContain('alt="Cast"');
    expect(main).not.toContain('<script>alert(1)');
  });

  it('scopes a section accent to that section and puts its backdrop behind it', async () => {
    const { main } = await serverRender(getRouter, '/channels/creator/shows', {
      handlers: handlers(),
    });

    expect(main).toContain('data-brand=');
    expect(main).toContain('data-slot="section-backdrop"');
  });

  it('renders not-found for a tab the API does not know', async () => {
    const { status } = await serverRender(getRouter, '/channels/creator/missing', {
      handlers: [
        mockEndpoint(getChannel, () => HttpResponse.json(channel())),
        mockEndpoint(getChannelPage, () => problemReply(ErrorCodes.CHANNEL_NOT_FOUND)),
        ...loaderApi(),
      ],
    });

    expect(status).toBe(404);
  });
});
