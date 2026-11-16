import { screen, within } from '@testing-library/react';
import { API_TOKEN_LIMITS } from '@vp/domain';
import { token, TOKEN_ID } from '#app/features/developers/__tests__/developers-api.fixture';
import { renderDevelopers } from '#app/features/developers/__tests__/render-developers';

const tokens = () => screen.getByRole('region', { name: 'Personal access tokens' });

describe('apps/client/studio: TokensSection', () => {
  it('lists each token with its prefix, scopes, use today and expiry, never a secret', async () => {
    await renderDevelopers({
      tokens: [
        token({
          scopes: ['analytics:read', 'videos:write'],
          lastUsedAt: '2026-03-01T11:00:00.000Z',
          requestsToday: 42,
        }),
      ],
    });

    const row = (await within(tokens()).findByText('Nightly analytics sync')).closest('tr');
    expect(row).not.toBeNull();
    const cells = within(row as HTMLElement);
    expect(cells.getByText('tt_pat_0a1b2c3d')).toBeInTheDocument();
    expect(cells.getByText('analytics:read')).toBeInTheDocument();
    expect(cells.getByText('videos:write')).toBeInTheDocument();
    expect(cells.getByText('42 requests today')).toBeInTheDocument();
    expect(cells.getByText('May 30, 2026')).toBeInTheDocument();
  });

  it('revokes a token once the creator confirms', async () => {
    const { user, requests } = await renderDevelopers({ tokens: [token()] });

    await user.click(
      await within(tokens()).findByRole('button', { name: 'Revoke Nightly analytics sync' })
    );
    const confirm = await screen.findByRole('alertdialog', {
      name: 'Revoke Nightly analytics sync?',
    });
    await user.click(within(confirm).getByRole('button', { name: 'Revoke' }));

    expect(await screen.findByText('Token revoked')).toBeInTheDocument();
    expect(requests.revoked).toEqual([TOKEN_ID]);
    expect(await within(tokens()).findByText('No tokens yet')).toBeInTheDocument();
  });

  it('offers no new token while the viewer holds the most there can be', async () => {
    await renderDevelopers({
      tokens: Array.from({ length: API_TOKEN_LIMITS.activePerUser }, (_, index) =>
        token({ id: `0190c3a0-5e1d-7000-8000-0000000ac${String(index).padStart(3, '0')}` })
      ),
    });

    expect(await within(tokens()).findByText(/You hold 10 active tokens/)).toBeInTheDocument();
    expect(within(tokens()).getByRole('button', { name: 'Create token' })).toBeDisabled();
  });
});
