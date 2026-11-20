import { screen } from '@testing-library/react';
import { createMyChannel } from '@vp/api-contracts';
import { ErrorCodes } from '@vp/errors';
import { apiServer, mockEndpoint, problemReply } from '@vp/web-testing';
import { HttpResponse } from 'msw';
import { renderIdentities, type TestAccount } from './render-identities';

const ADA: TestAccount = { slot: 0, name: 'Ada' };

async function openCreate() {
  const rendered = await renderIdentities({ accounts: [ADA] });
  await rendered.user.click(await screen.findByRole('button', { name: 'Account' }));
  await rendered.user.click(await screen.findByRole('menuitem', { name: 'Create channel' }));
  const dialog = await screen.findByRole('dialog', { name: 'Create a channel' });
  await rendered.user.type(screen.getByLabelText(/Handle/), 'engines');
  await rendered.user.type(screen.getByLabelText(/Channel name/), 'Engines');
  return { ...rendered, dialog };
}

describe('@vp/queries: CreateChannelDialog', () => {
  it('creates the channel, says so and closes', async () => {
    const sent: unknown[] = [];
    apiServer.use(
      mockEndpoint(createMyChannel, async ({ request }) => {
        sent.push(await request.json());
        return HttpResponse.json(
          {
            id: '0190c3a0-5e1d-7000-8000-0000000000c9',
            handle: 'engines',
            displayName: 'Engines',
            avatarUrl: null,
            isPrimary: false,
          },
          { status: 201 }
        );
      })
    );
    const { user } = await openCreate();

    await user.click(screen.getByRole('button', { name: 'Create' }));

    expect(await screen.findByText('Created Engines')).toBeInTheDocument();
    expect(sent).toEqual([{ handle: 'engines', displayName: 'Engines' }]);
    expect(screen.queryByRole('dialog', { name: 'Create a channel' })).not.toBeInTheDocument();
  });

  it('says why the API refused and keeps the form open', async () => {
    apiServer.use(
      mockEndpoint(createMyChannel, () => problemReply(ErrorCodes.CHANNEL_LIMIT_REACHED))
    );
    const { user, dialog } = await openCreate();

    await user.click(screen.getByRole('button', { name: 'Create' }));

    expect(
      await screen.findByRole('textbox', { name: /Handle/, description: /./ })
    ).toBeInTheDocument();
    expect(dialog).toBeInTheDocument();
  });
});
