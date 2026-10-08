import { screen } from '@testing-library/react';
import { getVideo } from '@vp/api-contracts';
import { ErrorCodes } from '@vp/errors';
import { HttpResponse } from 'msw';

import { VIDEO_ID, video } from '#app/__tests__/fixtures';
import { mockEndpoint, problemReply } from '#app/__tests__/msw/mock-endpoint';
import { renderRoute } from '#app/__tests__/render-route';

describe('apps/web: /watch/$videoId in the browser', () => {
  it('renders the video the loader fetched', async () => {
    await renderRoute(`/watch/${VIDEO_ID}`, {
      handlers: [mockEndpoint(getVideo, () => HttpResponse.json(video({ title: 'Launch day' })))],
    });

    expect(await screen.findByRole('heading', { name: 'Launch day' })).toBeInTheDocument();
    expect(document.title).toBe('Launch day');
  });

  it("renders the route's error page when the API fails", async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    await renderRoute(`/watch/${VIDEO_ID}`, {
      handlers: [mockEndpoint(getVideo, () => problemReply(ErrorCodes.INTERNAL))],
    });

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'There was an error while loading the page'
    );
  });
});
