import { screen, within } from '@testing-library/react';
import { DEFAULT_DISCLOSURE } from '@vp/domain';
import { ErrorCodes } from '@vp/errors';
import { inboxComment } from '@vp/web-testing';
import { renderInbox } from '#app/features/comments/__tests__/render-inbox';

const FIRST = inboxComment({ id: '0190c3a0-5e1d-7000-8000-00000000d001', content: 'First one' });
const SECOND = inboxComment({ id: '0190c3a0-5e1d-7000-8000-00000000d002', content: 'Second one' });

const selectBoth = async (user: Awaited<ReturnType<typeof renderInbox>>['user']) => {
  for (const { content } of [FIRST, SECOND]) {
    const row = screen.getByText(content).closest('tr') as HTMLElement;
    await user.click(within(row).getByRole('checkbox'));
  }
};

const bar = () => screen.getByRole('toolbar', { name: 'Moderate the selected comments' });

const settled = () =>
  vi.waitFor(() => expect(within(bar()).getByRole('button', { name: 'Approve' })).toBeEnabled());

describe('apps/client/studio: InboxBulkActions', () => {
  it('approves the selected comments in one call and says how many changed', async () => {
    const { user, requests } = await renderInbox('/comments', [[FIRST, SECOND]]);
    await selectBoth(user);

    await user.click(within(bar()).getByRole('button', { name: 'Approve' }));

    expect(await screen.findByText('2 comments updated')).toBeInTheDocument();
    await settled();
    expect(requests.bulks).toEqual([{ ids: [FIRST.id, SECOND.id], action: { action: 'approve' } }]);
  });

  it('hides silently without asking why, and visibly with a reason', async () => {
    const { user, requests } = await renderInbox('/comments', [[FIRST, SECOND]], {}, [], {
      disclosure: { ...DEFAULT_DISCLOSURE, hide: 'silent', remove: 'silent' },
    });
    await selectBoth(user);
    await vi.waitFor(() =>
      expect(within(bar()).getByRole('radio', { name: 'Silent' })).toBeChecked()
    );

    await user.click(within(bar()).getByRole('button', { name: 'Hide' }));
    await vi.waitFor(() => expect(requests.bulks).toHaveLength(1));
    await settled();
    await user.click(within(bar()).getByRole('radio', { name: 'Visible' }));
    await user.click(within(bar()).getByRole('button', { name: 'Hide' }));
    await user.click(await screen.findByRole('radio', { name: /Harassment/ }));
    await user.click(screen.getByRole('button', { name: /^Hide/ }));

    await vi.waitFor(() => expect(requests.bulks).toHaveLength(2));
    await settled();
    expect(requests.bulks.map(({ action }) => action)).toEqual([
      { action: 'hide', disclosure: 'silent' },
      { action: 'hide', disclosure: 'visible', reason: 'harassment' },
    ]);
  });

  it('starts on the channel default of each action, asking for a reason where it is visible', async () => {
    const { user, requests } = await renderInbox('/comments', [[FIRST]], {}, [], {
      disclosure: { ...DEFAULT_DISCLOSURE, hide: 'silent', remove: 'visible' },
    });
    await user.click(
      within(screen.getByText(FIRST.content).closest('tr') as HTMLElement).getByRole('checkbox')
    );

    await user.click(within(bar()).getByRole('button', { name: 'Hide' }));
    await vi.waitFor(() => expect(requests.bulks).toHaveLength(1));
    await settled();
    await user.click(within(bar()).getByRole('button', { name: 'Remove' }));
    await user.click(await screen.findByRole('radio', { name: /Harassment/ }));
    await user.click(screen.getByRole('button', { name: /^Remove/ }));

    await vi.waitFor(() => expect(requests.bulks).toHaveLength(2));
    expect(requests.bulks.map(({ action }) => action)).toEqual([
      { action: 'hide', disclosure: 'silent' },
      { action: 'remove', disclosure: 'visible', reason: 'harassment' },
    ]);
  });

  it('shows the control on the default when both actions share it', async () => {
    await renderInbox('/comments', [[FIRST]], {}, [], {
      disclosure: { ...DEFAULT_DISCLOSURE, hide: 'visible', remove: 'visible' },
    });

    expect(await within(bar()).findByRole('radio', { name: 'Visible' })).toBeChecked();
  });

  it('sends no disclosure when the settings are not readable', async () => {
    const { user, requests } = await renderInbox('/comments', [[FIRST]], {}, [], 'refused');
    await user.click(
      within(screen.getByText(FIRST.content).closest('tr') as HTMLElement).getByRole('checkbox')
    );

    await user.click(within(bar()).getByRole('button', { name: 'Hide' }));
    await user.click(await screen.findByRole('radio', { name: /Harassment/ }));
    await user.click(screen.getByRole('button', { name: /^Hide/ }));

    await vi.waitFor(() => expect(requests.bulks).toHaveLength(1));
    expect(requests.bulks[0]?.action).toEqual({ action: 'hide', reason: 'harassment' });
    expect(within(bar()).getByRole('radio', { name: 'Silent' })).not.toBeChecked();
    expect(within(bar()).getByRole('radio', { name: 'Visible' })).not.toBeChecked();
  });

  it('names each refused id and why, and keeps those rows selected', async () => {
    const { user } = await renderInbox('/comments', [[FIRST, SECOND]], {
      [SECOND.id]: ErrorCodes.MODERATION_NOT_APPLICABLE,
    });
    await selectBoth(user);

    await user.click(within(bar()).getByRole('button', { name: 'Approve' }));

    expect(await screen.findByText('1 of 2 done, 1 refused')).toBeInTheDocument();
    expect(
      screen.getByText('0190c3a0: That action does not apply to this comment in its current state.')
    ).toBeInTheDocument();
    const rowOf = (text: string) => screen.getByText(text).closest('tr') as HTMLElement;
    expect(within(rowOf(FIRST.content)).getByRole('checkbox')).not.toBeChecked();
    expect(within(rowOf(SECOND.content)).getByRole('checkbox')).toBeChecked();
  });

  it('bans the authors for a chosen time with the reason written', async () => {
    const { user, requests } = await renderInbox('/comments', [[FIRST]]);
    await user.click(
      within(screen.getByText(FIRST.content).closest('tr') as HTMLElement).getByRole('checkbox')
    );

    await user.click(within(bar()).getByRole('button', { name: 'Ban' }));
    await user.click(await screen.findByRole('radio', { name: /Hate/ }));
    await user.type(screen.getByRole('textbox', { name: 'Note to the author' }), 'No more');
    await user.click(screen.getByRole('button', { name: /^Ban/ }));

    await vi.waitFor(() => expect(requests.bulks).toHaveLength(1));
    await settled();
    expect(requests.bulks[0]?.action).toMatchObject({ action: 'ban', reason: 'No more' });
  });
});
