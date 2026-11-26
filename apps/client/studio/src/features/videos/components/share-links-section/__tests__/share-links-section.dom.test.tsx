import { axeViolations } from '@kit/web-testing/dom';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { VIDEO_ID, video } from '@vp/web-testing';
import { renderRoute } from '@vp/web-testing/dom';
import { signInBrowser } from '#app/__tests__/providers';
import { serveSharing, shareLink } from '#app/features/videos/__tests__/sharing-api.fixture';
import { WEB_URL } from '#app/lib/config';
import { getRouter } from '#app/router';

async function renderSharing(options: Parameters<typeof serveSharing>[1] = {}) {
  const user = userEvent.setup();
  const served = serveSharing(video({ title: 'Launch day', visibility: 'private' }), options);
  await renderRoute(getRouter, `/videos/${VIDEO_ID}/edit?tab=sharing`, {
    handlers: [signInBrowser()],
  });
  const table = await screen.findByRole('table', { name: 'Share links of this video' });
  return { ...served, table, user };
}

const rowOf = (table: HTMLElement, label: string) =>
  within(table)
    .getAllByRole('row')
    .find((row) => row.textContent?.includes(label)) as HTMLElement;

describe('apps/client/studio: ShareLinksSection', () => {
  it('shows the label, state, expiry and numbers of each link', async () => {
    const { table } = await renderSharing();

    const cells = within(rowOf(table, 'Press preview')).getAllByRole('cell');

    expect(cells.slice(0, 6).map((cell) => cell.textContent)).toEqual([
      'Press preview',
      'Active',
      'Never',
      '12',
      '30',
      '1 hr, 2 min, 5 sec',
    ]);
  });

  it('copies the watch address carrying the token', async () => {
    const { user } = await renderSharing();

    await user.click(screen.getByRole('button', { name: 'Copy the link Press preview' }));

    expect(await navigator.clipboard.readText()).toBe(
      `${WEB_URL}/watch/${VIDEO_ID}?s=abcdefghijklmnopqrstuv`
    );
    expect(await screen.findByText('Copied: share link')).toBeInTheDocument();
  });

  it('revokes a link and shows it revoked, with no action left on it', async () => {
    const { state, table, user } = await renderSharing();

    await user.click(screen.getByRole('button', { name: 'Revoke the link Press preview' }));

    expect(within(rowOf(table, 'Press preview')).getByText('Revoked')).toBeInTheDocument();
    expect(within(rowOf(table, 'Press preview')).queryByRole('button')).toBeNull();
    expect(await screen.findByText('Share link revoked')).toBeInTheDocument();
    expect(state.revoked).toEqual([shareLink().id]);
  });

  it('puts a link back when the revoke is refused, and says so', async () => {
    const { table, user } = await renderSharing({ revokeFails: true });

    await user.click(screen.getByRole('button', { name: 'Revoke the link Press preview' }));

    expect(await screen.findByText('The share link was not revoked.')).toBeInTheDocument();
    expect(within(rowOf(table, 'Press preview')).getByText('Active')).toBeInTheDocument();
  });

  it.each([
    { state: 'expired' as const, shown: 'Expired' },
    { state: 'revoked' as const, shown: 'Revoked' },
  ])('offers nothing on a link that is $state', async ({ state, shown }) => {
    const { table } = await renderSharing({ links: [shareLink({ state, label: null })] });

    expect(rowOf(table, shown)).toHaveTextContent('No label');
    expect(within(rowOf(table, shown)).queryByRole('button')).toBeNull();
  });

  it('says when the video has no links', async () => {
    serveSharing(video(), { links: [] });
    await renderRoute(getRouter, `/videos/${VIDEO_ID}/edit?tab=sharing`, {
      handlers: [signInBrowser()],
    });

    expect(await screen.findByText('No share links yet.')).toBeInTheDocument();
  });

  it('has no accessibility violations', async () => {
    await renderSharing();

    expect(await axeViolations()).toEqual([]);
  });
});
