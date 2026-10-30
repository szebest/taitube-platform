import { screen } from '@testing-library/react';
import { getClip } from '@vp/api-contracts';
import { ErrorCodes } from '@vp/errors';
import { CLIP_ID, clip, mockEndpoint, problemReply } from '@vp/web-testing';
import { renderRoute } from '@vp/web-testing/dom';
import { HttpResponse } from 'msw/http';

import { loaderApi } from '#app/__tests__/loader-api';
import { getRouter } from '#app/router';

vi.mock(import('#app/features/player'), async (importOriginal) => ({
  ...(await importOriginal()),
  TaitubePlayer: (await import('#app/features/watch/__tests__/stub-player')).StubPlayer,
}));

describe('apps/client/web: /clip/$clipId in the browser', () => {
  it('renders the clip the loader fetched and titles the document with it', async () => {
    await renderRoute(getRouter, `/clip/${CLIP_ID}`, {
      handlers: [mockEndpoint(getClip, () => HttpResponse.json(clip())), ...loaderApi()],
    });

    expect(
      await screen.findByRole('heading', { level: 1, name: 'The best part' })
    ).toBeInTheDocument();
    expect(document.title).toBe('The best part');
  });

  it.each([
    { scenario: 'the API has no such clip', path: `/clip/${CLIP_ID}`, answer: true },
    { scenario: 'the id is not a clip id', path: '/clip/not-an-id', answer: false },
  ])('renders the not found page when $scenario', async ({ path, answer }) => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    await renderRoute(getRouter, path, {
      handlers: [
        ...(answer ? [mockEndpoint(getClip, () => problemReply(ErrorCodes.CLIP_NOT_FOUND))] : []),
        ...loaderApi(),
      ],
    });

    expect(await screen.findByRole('heading', { level: 1 })).toHaveTextContent(
      'This page does not exist.'
    );
  });
});
