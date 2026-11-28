import { render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { PartyPermissionsProvider } from '@vp/permissions-react';
import { AppProviders } from '#app/__tests__/providers';
import { ReactionOverlay } from '..';

function renderBar(permissions: readonly 'chat.react'[]) {
  const onReact = vi.fn();
  render(
    <AppProviders>
      <PartyPermissionsProvider
        userContext={null}
        viewer={{ permissions: [...permissions], topPosition: 20, isOwner: false, kind: 'user' }}
      >
        <ReactionOverlay.Bar emojis={['🔥', '🎉']} onReact={onReact} />
      </PartyPermissionsProvider>
    </AppProviders>
  );

  return onReact;
}

describe('apps/client/web: ReactionOverlay', () => {
  it('sends the emoji a viewer with chat.react picks', async () => {
    const onReact = renderBar(['chat.react']);

    await userEvent.click(screen.getByRole('button', { name: 'React with 🎉' }));

    expect(onReact).toHaveBeenCalledWith('🎉');
  });

  it('offers no palette without chat.react', () => {
    renderBar([]);

    expect(screen.queryByRole('group', { name: 'Reactions' })).not.toBeInTheDocument();
  });

  it('shows a reduced-motion chip with its count, named for a screen reader', () => {
    render(
      <AppProviders>
        <ReactionOverlay.Chip emoji="🔥" count={3} />
      </AppProviders>
    );

    expect(screen.getByRole('img', { name: '3 reactions 🔥' })).toBeInTheDocument();
  });
});
