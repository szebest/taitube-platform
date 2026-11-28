import { render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { AppProviders } from '#app/__tests__/providers';
import { PartyControlsList } from '..';

describe('apps/client/web: PartyControlsList', () => {
  it('names each entry and removes the one chosen', async () => {
    const onRemove = vi.fn();
    render(
      <AppProviders>
        <PartyControlsList.Root>
          <PartyControlsList.Item name="user:ana" onRemove={vi.fn()} />
          <PartyControlsList.Item name="user:bruno" onRemove={onRemove} />
        </PartyControlsList.Root>
      </AppProviders>
    );

    await userEvent.click(
      screen.getByRole('button', { name: 'Remove the controls for user:bruno' })
    );

    expect(onRemove).toHaveBeenCalledOnce();
    expect(screen.getByText('Member user:ana')).toBeInTheDocument();
  });

  it('says when there is nothing to remove', () => {
    render(
      <AppProviders>
        <PartyControlsList.Empty />
      </AppProviders>
    );

    expect(screen.getByText('Nothing is hidden or muted everywhere')).toBeInTheDocument();
  });
});
