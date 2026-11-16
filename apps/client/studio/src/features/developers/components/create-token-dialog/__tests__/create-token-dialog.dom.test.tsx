import { screen, within } from '@testing-library/react';
import { ErrorCodes } from '@vp/errors';
import { SECRET } from '#app/features/developers/__tests__/developers-api.fixture';
import { renderDevelopers } from '#app/features/developers/__tests__/render-developers';

const tokens = () => screen.getByRole('region', { name: 'Personal access tokens' });

async function openDialog(state: Parameters<typeof renderDevelopers>[0] = {}) {
  const rendered = await renderDevelopers(state);
  await rendered.user.click(within(tokens()).getByRole('button', { name: 'Create token' }));
  return {
    ...rendered,
    dialog: await screen.findByRole('dialog', { name: 'Create a personal access token' }),
  };
}

describe('apps/client/studio: CreateTokenDialog', () => {
  it('asks for a name and a scope before it sends anything', async () => {
    const { user, dialog, requests } = await openDialog();

    await user.click(within(dialog).getByRole('button', { name: 'Create token' }));

    expect(within(dialog).getByText('Give the token a name.')).toBeInTheDocument();
    expect(within(dialog).getByRole('alert')).toHaveTextContent('Pick at least one scope.');
    expect(requests.tokens).toEqual([]);
  });

  it('creates the token, shows its secret once and closes only once the creator saved it', async () => {
    const { user, dialog, requests } = await openDialog();

    await user.type(within(dialog).getByRole('textbox', { name: /Name/ }), 'Nightly sync');
    await user.click(within(dialog).getByRole('checkbox', { name: 'Read views and watch time' }));
    await user.click(
      within(dialog).getByRole('checkbox', { name: 'Edit details, chapters and visibility' })
    );
    await user.click(within(dialog).getByRole('button', { name: 'Create token' }));

    const reveal = await screen.findByRole('dialog', { name: 'Copy your token' });
    expect(requests.tokens).toEqual([
      { name: 'Nightly sync', expiry: '90d', scopes: ['analytics:read', 'videos:write'] },
    ]);
    expect(within(reveal).getByRole('textbox', { name: 'Token for Nightly sync' })).toHaveValue(
      SECRET
    );
    const done = within(reveal).getByRole('button', { name: 'Done' });
    expect(done).toBeDisabled();

    await user.keyboard('{Escape}');
    expect(screen.getByRole('dialog', { name: 'Copy your token' })).toBeInTheDocument();

    await user.click(
      within(reveal).getByRole('checkbox', { name: 'I saved this token somewhere safe' })
    );
    await user.click(done);

    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.queryByDisplayValue(SECRET)).toBeNull();
    expect(await within(tokens()).findByText('Nightly sync')).toBeInTheDocument();
  });

  it('says why the API refused the token and keeps the form', async () => {
    const { user, dialog } = await openDialog({
      createFailure: ErrorCodes.API_TOKEN_LIMIT_REACHED,
    });

    await user.type(within(dialog).getByRole('textbox', { name: /Name/ }), 'One too many');
    await user.click(within(dialog).getByRole('checkbox', { name: 'Read comments' }));
    await user.click(within(dialog).getByRole('button', { name: 'Create token' }));

    expect(await screen.findByText('The token was not created.')).toBeInTheDocument();
    expect(within(dialog).getByRole('textbox', { name: /Name/ })).toHaveValue('One too many');
  });
});
