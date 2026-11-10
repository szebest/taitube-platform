import { render, screen, within } from '@testing-library/react';
import { updateCommentSettings } from '@vp/api-contracts';
import { ErrorCodes } from '@vp/errors';
import type { UserContext } from '@vp/permissions';
import { PermissionsProvider } from '@vp/permissions-react';
import { apiServer, mockEndpoint, problemReply } from '@vp/web-testing';
import { AppProviders } from '#app/__tests__/providers';
import { renderSettings, sectionOf } from '#app/features/comments/__tests__/render-settings';
import { CommentSettingsPage } from '../comment-settings-page';

const SECTIONS = [
  'Review',
  'Blocked words',
  'Allowed links',
  'Slow mode',
  'Subscribers only',
  'Account age',
  'What authors are told',
];

describe('apps/client/studio: CommentSettingsPage', () => {
  it('lists every section, the ones that save and the ones that change records in place', async () => {
    await renderSettings();

    expect(SECTIONS.map((name) => sectionOf(name))).toHaveLength(SECTIONS.length);
    for (const name of ['Trusted commenters', 'Restrictions', 'Saved replies']) {
      expect(screen.getByRole('region', { name })).toBeInTheDocument();
    }
    expect(screen.getAllByRole('button', { name: 'Save' })).toHaveLength(SECTIONS.length);
  });

  it('holds every save back until its own section changed', async () => {
    await renderSettings();

    expect(
      screen.getAllByRole('button', { name: 'Save' }).every((save) => save.hasAttribute('disabled'))
    ).toBe(true);
  });

  it('saves each section on its own, on top of what another section saved', async () => {
    const { user, sent } = await renderSettings();

    await user.click(within(sectionOf('Review')).getByRole('radio', { name: 'Everything' }));
    await user.click(within(sectionOf('Review')).getByRole('button', { name: 'Save' }));
    await vi.waitFor(() => expect(sent.saves).toHaveLength(1));
    await user.click(within(sectionOf('Subscribers only')).getByRole('switch'));
    await user.click(within(sectionOf('Subscribers only')).getByRole('button', { name: 'Save' }));

    await vi.waitFor(() => expect(sent.saves).toHaveLength(2));
    expect(sent.saves[1]).toMatchObject({ reviewMode: 'all', subscribersOnly: true });
    expect(await within(sectionOf('Subscribers only')).findByText('Saved')).toBeInTheDocument();
  });

  it('says a section was not saved without touching the others', async () => {
    const { user } = await renderSettings();
    apiServer.use(mockEndpoint(updateCommentSettings, () => problemReply(ErrorCodes.INTERNAL)));

    await user.click(within(sectionOf('Review')).getByRole('radio', { name: 'Links' }));
    await user.click(within(sectionOf('Review')).getByRole('button', { name: 'Save' }));

    expect(await within(sectionOf('Review')).findByRole('alert')).toBeInTheDocument();
    expect(within(sectionOf('Slow mode')).queryByRole('alert')).not.toBeInTheDocument();
  });

  it.each<{ role: UserContext['role']; memberships?: UserContext['memberships'] }>([
    { role: 'USER', memberships: { c: { ownerId: 'someone-else', role: 'moderator' } } },
  ])(
    'tells someone who may not change the settings so, and shows none',
    ({ role, memberships }) => {
      const viewer: UserContext = { id: 'u1', role, memberships };
      render(
        <PermissionsProvider userContext={viewer}>
          <CommentSettingsPage channel={{ channelId: 'c', ownerId: 'someone-else' }} />
        </PermissionsProvider>,
        { wrapper: AppProviders }
      );

      expect(
        screen.getByText('Only the owner and managers change these settings.')
      ).toBeInTheDocument();
      expect(screen.queryByRole('form')).not.toBeInTheDocument();
    }
  );
});
