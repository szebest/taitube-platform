import { screen, waitFor } from '@testing-library/react';
import { appealScreening } from '@vp/api-contracts';
import { VIDEO_ID, apiServer, mockEndpoint, problemReply, video } from '@vp/web-testing';
import { renderRoute } from '@vp/web-testing/dom';
import { signInBrowser } from '#app/__tests__/providers';
import { serveEditor } from '#app/features/videos/__tests__/edit-api.fixture';
import {
  creatorScreening,
  serveScreening,
} from '#app/features/videos/__tests__/screening-api.fixture';
import { getRouter } from '#app/router';

const openRejected = async () => {
  serveEditor(video({ status: 'REJECTED' }));
  const served = serveScreening(
    creatorScreening({ status: 'REJECTED', decision: 'rejected', canAppeal: true })
  );
  const rendered = await renderRoute(getRouter, `/videos/${VIDEO_ID}/edit`, {
    handlers: [signInBrowser()],
  });
  return {
    ...rendered,
    ...served,
    box: await screen.findByRole('textbox', { name: 'Why is this a mistake?' }),
  };
};

describe('apps/client/studio: ScreeningAppealForm', () => {
  it('needs a message and sends it trimmed', async () => {
    const { user, appeals, box } = await openRejected();
    const send = screen.getByRole('button', { name: 'Send appeal' });

    expect(send).toBeDisabled();
    await user.type(box, '  This is my own footage ');
    await user.click(send);

    await waitFor(() => expect(appeals).toEqual([{ message: 'This is my own footage' }]));
  });

  it('toasts when the appeal is refused', async () => {
    const { user, box } = await openRejected();
    apiServer.use(mockEndpoint(appealScreening, () => problemReply('FORBIDDEN')));

    await user.type(box, 'Mistake');
    await user.click(screen.getByRole('button', { name: 'Send appeal' }));

    expect(await screen.findByText('The appeal was not sent.')).toBeInTheDocument();
  });
});
