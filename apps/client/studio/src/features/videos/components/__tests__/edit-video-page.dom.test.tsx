import { screen } from '@testing-library/react';
import { VIDEO_ID, account, video } from '@vp/web-testing';
import { renderRoute } from '@vp/web-testing/dom';
import { signInBrowser } from '#app/__tests__/providers';
import { serveEditor } from '#app/features/videos/__tests__/edit-api.fixture';
import { getRouter } from '#app/router';

const OTHER_USER_ID = '0190c3a0-5e1d-7000-8000-00000000b0ff';

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

  it('shows the captions section to the owner of the video', async () => {
    serveEditor(video({ title: 'Launch day' }));

    await renderRoute(getRouter, `/videos/${VIDEO_ID}/edit`, { handlers: [signInBrowser()] });

    expect(await screen.findByRole('heading', { name: 'Captions' })).toBeInTheDocument();
  });

  it.each([
    { who: 'a guest account', signedIn: account({ role: 'GUEST' }) },
    {
      who: 'a creator who is not its owner',
      signedIn: account({ id: OTHER_USER_ID, user: { ...account().user, id: OTHER_USER_ID } }),
    },
  ])('hides the captions section from $who', async ({ signedIn }) => {
    serveEditor(video({ title: 'Launch day' }));

    await renderRoute(getRouter, `/videos/${VIDEO_ID}/edit`, {
      handlers: [signInBrowser(signedIn)],
    });
    await screen.findByRole('button', { name: 'Save changes' });

    expect(screen.queryByRole('heading', { name: 'Captions' })).toBeNull();
  });
});
