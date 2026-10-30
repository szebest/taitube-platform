import { screen, within } from '@testing-library/react';
import { type CommentView, createComment, listVideoComments } from '@vp/api-contracts';
import { ErrorCodes } from '@vp/errors';
import { apiServer, mockEndpoint, problemReply } from '@vp/web-testing';
import { HttpResponse } from 'msw/http';

import { AUTHOR_ID, comment, viewerAccount } from '#app/features/watch/__tests__/comment-fixtures';
import { RecordingObserver } from '#app/features/watch/__tests__/recording-observer';
import { renderDiscussion } from '#app/features/watch/__tests__/render-discussion';
import { renderWatch } from '#app/features/watch/__tests__/render-watch';

vi.mock(import('#app/features/player'), async (importOriginal) => ({
  ...(await importOriginal()),
  TaitubePlayer: (await import('#app/features/watch/__tests__/stub-player')).StubPlayer,
}));

const FIRST = 'cursor-2';

interface Listing {
  items: CommentView[];
  nextCursor?: string | null;
  total?: number;
}

function listed({ items, nextCursor = null, total = items.length }: Listing, asked: URL[] = []) {
  return mockEndpoint(listVideoComments, ({ request }) => {
    asked.push(new URL(request.url));
    return HttpResponse.json({ items, nextCursor, total });
  });
}

describe('apps/client/web: watch comment thread', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('sends no comments request until the section nears the viewport, then one', async () => {
    RecordingObserver.install();
    const asked: URL[] = [];
    await renderWatch({ handlers: [listed({ items: [comment()] }, asked)] });

    expect(asked).toHaveLength(0);
    expect(RecordingObserver.all[0]?.rootMargin).toMatch(/^0px 0px [1-9]\d*px 0px$/);

    RecordingObserver.enterView();

    expect(await screen.findByText('Ines Carvalho')).toBeInTheDocument();
    expect(asked).toHaveLength(1);
  });

  it('puts the pinned comment first and counts every comment', async () => {
    await renderDiscussion({
      handlers: [
        listed({
          items: [
            comment({ id: '0190c3a0-5e1d-7000-8000-00000000d010', content: 'Plain one' }),
            comment({
              id: '0190c3a0-5e1d-7000-8000-00000000d011',
              content: 'Pinned one',
              isPinned: true,
            }),
          ],
          total: 1284,
        }),
      ],
    });

    const items = within(await screen.findByRole('region', { name: /Discussion/ })).getAllByRole(
      'article'
    );

    expect(items[0]).toHaveTextContent('Pinned one');
    expect(items[1]).toHaveTextContent('Plain one');
    expect(screen.getByRole('heading', { name: 'Discussion · 1.3K' })).toBeInTheDocument();
  });

  it('says so when nobody has commented', async () => {
    await renderDiscussion({ handlers: [listed({ items: [] })] });

    expect(await screen.findByText('Nobody has said anything yet')).toBeInTheDocument();
  });

  it('shows a section error with a retry while the video keeps rendering, and recovers on retry', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const failing = mockEndpoint(listVideoComments, () => problemReply(ErrorCodes.INTERNAL));
    const { user } = await renderDiscussion({ handlers: [failing] });

    const alert = await screen.findByRole('alert');

    expect(alert).toHaveTextContent('The discussion could not be loaded');
    expect(screen.getByRole('heading', { level: 1, name: 'Launch day' })).toBeInTheDocument();

    const recovered = listed({ items: [comment()] });
    apiServer.use(recovered);
    await user.click(within(alert).getByRole('button', { name: 'Try again' }));

    expect(await screen.findByText('Ines Carvalho')).toBeInTheDocument();
  });

  it('loads the next page with the cursor the last one gave', async () => {
    const asked: URL[] = [];
    const pages = mockEndpoint(listVideoComments, ({ request }) => {
      const url = new URL(request.url);
      asked.push(url);
      return url.searchParams.has('cursor')
        ? HttpResponse.json({
            items: [
              comment({ id: '0190c3a0-5e1d-7000-8000-00000000d020', content: 'Second page' }),
            ],
            nextCursor: null,
            total: 2,
          })
        : HttpResponse.json({ items: [comment()], nextCursor: FIRST, total: 2 });
    });
    const { user } = await renderDiscussion({ handlers: [pages] });

    await user.click(await screen.findByRole('button', { name: 'Show more comments' }));

    expect(await screen.findByText('Second page')).toBeInTheDocument();
    expect(asked.map((url) => url.searchParams.get('cursor'))).toEqual([null, FIRST]);
  });

  it('asks again for the other order when the sort changes', async () => {
    const asked: URL[] = [];
    const { user } = await renderDiscussion({ handlers: [listed({ items: [comment()] }, asked)] });
    await screen.findByText('Ines Carvalho');

    await user.click(screen.getByRole('radio', { name: 'Newest' }));

    await vi.waitFor(() =>
      expect(asked.map((url) => url.searchParams.get('sort'))).toEqual(['top', 'newest'])
    );
  });

  it('asks a guest to sign in instead of offering the composer', async () => {
    await renderDiscussion({ handlers: [listed({ items: [comment()] })] });

    expect(await screen.findByRole('link', { name: 'Sign in' })).toHaveAttribute(
      'href',
      expect.stringContaining('/login')
    );
    expect(screen.queryByRole('textbox', { name: 'Add a comment' })).not.toBeInTheDocument();
  });

  it('posts a comment and shows it once the list reloads', async () => {
    const posted: unknown[] = [];
    let listing: CommentView[] = [comment()];
    const create = mockEndpoint(createComment, async ({ request }) => {
      const body = await request.json();
      posted.push(body);
      listing = [
        comment({ id: '0190c3a0-5e1d-7000-8000-00000000d030', content: body.content }),
        ...listing,
      ];
      return HttpResponse.json(listing[0], { status: 201 });
    });
    const list = mockEndpoint(listVideoComments, () =>
      HttpResponse.json({ items: listing, nextCursor: null, total: listing.length })
    );
    const { user } = await renderDiscussion({
      viewer: viewerAccount(AUTHOR_ID),
      handlers: [create, list],
    });

    await user.type(await screen.findByRole('textbox', { name: 'Add a comment' }), 'Lovely  ');
    await user.click(screen.getByRole('button', { name: 'Comment' }));

    expect(await screen.findByText('Lovely')).toBeInTheDocument();
    expect(posted).toEqual([{ content: 'Lovely' }]);
  });

  it('marks a comment that failed to post, and posts it again on retry', async () => {
    let attempts = 0;
    const create = mockEndpoint(createComment, () =>
      attempts++ === 0
        ? problemReply(ErrorCodes.INTERNAL)
        : HttpResponse.json(comment({ content: 'Lovely' }), { status: 201 })
    );
    const { user } = await renderDiscussion({
      viewer: viewerAccount(AUTHOR_ID),
      handlers: [create, listed({ items: [comment()] })],
    });

    await user.type(await screen.findByRole('textbox', { name: 'Add a comment' }), 'Lovely');
    await user.click(screen.getByRole('button', { name: 'Comment' }));

    expect(await screen.findByText('Not posted')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Try again' }));

    await vi.waitFor(() => expect(screen.queryByText('Not posted')).not.toBeInTheDocument());
  });
});
