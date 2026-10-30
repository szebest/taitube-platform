import { screen, within } from '@testing-library/react';
import { clearWatchHistory } from '@vp/api-contracts';
import { ErrorCodes } from '@vp/errors';
import { mockEndpoint, problemReply } from '@vp/web-testing';
import { renderRoute } from '@vp/web-testing/dom';
import { HttpResponse } from 'msw/http';

import { signInBrowser } from '#app/__tests__/providers';
import { getRouter } from '#app/router';

function renderPrivacy(reply: () => Response = () => new HttpResponse(null, { status: 204 })) {
  const calls: string[] = [];
  const clear = mockEndpoint(clearWatchHistory, () => {
    calls.push('clear');
    return reply();
  });
  const rendered = renderRoute(getRouter, '/settings/privacy', {
    handlers: [signInBrowser(), clear],
  });
  return { rendered, calls };
}

const openDialog = async (user: Awaited<ReturnType<typeof renderRoute>>['user']) => {
  await user.click(await screen.findByRole('button', { name: 'Clear history' }));
  return screen.findByRole('dialog', { name: 'Clear your watch history?' });
};

describe('apps/client/web: the clear history row', () => {
  it('clears nothing until the confirmation is given, then says it is done', async () => {
    const { rendered, calls } = renderPrivacy();
    const { user } = await rendered;
    await openDialog(user);
    expect(calls).toEqual([]);

    await user.click(
      within(screen.getByRole('dialog')).getByRole('button', { name: 'Clear history' })
    );

    expect(await screen.findByText('Watch history cleared')).toBeInTheDocument();
    expect(calls).toEqual(['clear']);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('leaves the history alone when the dialog is cancelled', async () => {
    const { rendered, calls } = renderPrivacy();
    const { user } = await rendered;
    await openDialog(user);

    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(screen.queryByRole('dialog')).toBeNull();
    expect(calls).toEqual([]);
  });

  it('says so when the server refuses, and keeps the dialog open to try again', async () => {
    const { rendered } = renderPrivacy(() => problemReply(ErrorCodes.INTERNAL));
    const { user } = await rendered;
    await openDialog(user);

    await user.click(
      within(await screen.findByRole('dialog')).getByRole('button', { name: 'Clear history' })
    );

    expect(await screen.findByText('Could not clear your watch history')).toBeInTheDocument();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });
});
