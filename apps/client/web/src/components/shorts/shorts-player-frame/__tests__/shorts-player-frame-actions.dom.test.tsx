import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Icon } from '@vp/ui';

import { AppProviders } from '#app/__tests__/providers';
import { ShortsPlayerFrameRoot } from '../shorts-player-frame';
import { ShortsPlayerFrameAction, ShortsPlayerFrameActions } from '../shorts-player-frame-actions';

function renderActions(count?: string, pressed?: boolean) {
  const onSelect = vi.fn();
  render(
    <AppProviders>
      <ShortsPlayerFrameRoot>
        <ShortsPlayerFrameActions>
          <ShortsPlayerFrameAction
            icon={<Icon name="like" />}
            count={count}
            pressed={pressed}
            onSelect={onSelect}
          >
            Like
          </ShortsPlayerFrameAction>
        </ShortsPlayerFrameActions>
      </ShortsPlayerFrameRoot>
    </AppProviders>
  );
  return { onSelect, user: userEvent.setup() };
}

describe('apps/client/web: ShortsPlayerFrameAction', () => {
  it.each([
    { count: undefined, name: 'Like' },
    { count: '24K', name: 'Like 24K' },
  ])('is named $name for a count of $count', ({ count, name }) => {
    renderActions(count);

    expect(screen.getByRole('button', { name })).toBeInTheDocument();
  });

  it.each([
    { pressed: undefined, attribute: null },
    { pressed: true, attribute: 'true' },
    { pressed: false, attribute: 'false' },
  ])('reports pressed $pressed as $attribute', ({ pressed, attribute }) => {
    renderActions('24K', pressed);

    expect(screen.getByRole('button').getAttribute('aria-pressed')).toBe(attribute);
  });

  it('selects on a click', async () => {
    const { user, onSelect } = renderActions();

    await user.click(screen.getByRole('button', { name: 'Like' }));

    expect(onSelect).toHaveBeenCalledOnce();
  });
});
