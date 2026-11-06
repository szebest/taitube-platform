import { screen } from '@testing-library/react';
import { VIDEO_ID, video } from '@vp/web-testing';
import { renderRoute } from '@vp/web-testing/dom';
import { signInBrowser } from '#app/__tests__/providers';
import { serveEditor } from '#app/features/videos/__tests__/edit-api.fixture';
import { getRouter } from '#app/router';

describe('apps/client/studio: EditVideoPage', () => {
  it('titles the page with the video and shows its processing next to the form', async () => {
    serveEditor(video({ title: 'Launch day', status: 'PROCESSING' }));

    await renderRoute(getRouter, `/videos/${VIDEO_ID}/edit`, { handlers: [signInBrowser()] });

    expect(
      await screen.findByRole('heading', { name: 'Editing video: Launch day' })
    ).toBeInTheDocument();
    expect(screen.getByRole('status', { name: 'Processing status' })).toHaveTextContent(
      'Processing'
    );
    expect(screen.getByRole('button', { name: 'Save changes' })).toBeInTheDocument();
  });
});
