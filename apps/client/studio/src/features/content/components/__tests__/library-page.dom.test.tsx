import { screen, within } from '@testing-library/react';
import { getVideo } from '@vp/api-contracts';
import { apiServer, mockEndpoint, video } from '@vp/web-testing';
import { renderRoute } from '@vp/web-testing/dom';
import { HttpResponse } from 'msw/http';

import { signInBrowser } from '#app/__tests__/providers';
import { creatorVideo, videoIdOf } from '#app/features/content/__tests__/creator-video.fixture';
import { serveLibrary } from '#app/features/content/__tests__/library-api.fixture';
import { getRouter } from '#app/router';

async function renderPage() {
  serveLibrary([
    {
      cursor: null,
      items: [
        creatorVideo({ id: videoIdOf(0), title: 'Lisbon at night' }),
        creatorVideo({ id: videoIdOf(1), title: 'Harbour at dawn' }),
      ],
      next: null,
    },
  ]);
  apiServer.use(
    mockEndpoint(getVideo, ({ params }) =>
      HttpResponse.json(video({ id: String(params.id), title: 'Harbour at dawn' }))
    )
  );
  const rendered = await renderRoute(getRouter, '/videos', { handlers: [signInBrowser()] });
  await screen.findByRole('table', { name: 'Your videos' });
  return rendered;
}

const inspector = () => screen.findByRole('dialog', { name: 'Video details' });

describe('apps/client/studio: LibraryPage', () => {
  it('heads the library, with no inspector open until a video is chosen', async () => {
    await renderPage();

    expect(screen.getByRole('heading', { level: 1, name: 'Your videos' })).toBeInTheDocument();
    expect(screen.queryByRole('dialog', { name: 'Video details' })).not.toBeInTheDocument();
  });

  it('opens the video of the row Enter is pressed on in the inspector', async () => {
    const { user } = await renderPage();

    within(screen.getByRole('table')).getAllByRole('row')[2]?.focus();
    await user.keyboard('{Enter}');

    expect(
      await within(await inspector()).findByRole('heading', { name: 'Harbour at dawn' })
    ).toBeInTheDocument();
  });

  it('opens the video of the title that is clicked in the inspector', async () => {
    const { user } = await renderPage();

    await user.click(screen.getByRole('button', { name: 'Harbour at dawn' }));

    expect(
      await within(await inspector()).findByRole('heading', { name: 'Harbour at dawn' })
    ).toBeInTheDocument();
  });
});
