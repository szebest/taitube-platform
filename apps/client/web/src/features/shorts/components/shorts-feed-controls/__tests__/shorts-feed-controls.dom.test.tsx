import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axeViolations } from '@vp/web-testing/dom';
import { AppProviders } from '#app/__tests__/providers';
import { ShortsPlayerFrameRoot } from '#app/components/shorts/shorts-player-frame/shorts-player-frame';
import { ShortsFeedControls, type ShortsFeedControlsProps } from '../shorts-feed-controls';

function renderControls(props: Partial<ShortsFeedControlsProps> = {}) {
  const handlers = {
    onToggleMute: vi.fn(),
    onToggleCaptions: vi.fn(),
    onSpeedChange: vi.fn(),
  };
  render(
    <AppProviders>
      <ShortsPlayerFrameRoot>
        <ShortsFeedControls muted captions={false} hasCaptions speed={1} {...handlers} {...props} />
      </ShortsPlayerFrameRoot>
    </AppProviders>
  );
  return { user: userEvent.setup(), ...handlers };
}

const toolbar = () => screen.getByRole('toolbar', { name: 'Short controls' });

describe('apps/client/web: ShortsFeedControls', () => {
  it.each([
    { muted: true, name: 'Unmute' },
    { muted: false, name: 'Mute' },
  ])('names the sound control $name while muted is $muted', async ({ muted, name }) => {
    const { user, onToggleMute } = renderControls({ muted });

    await user.click(within(toolbar()).getByRole('button', { name }));

    expect(onToggleMute).toHaveBeenCalledOnce();
  });

  it.each([
    { captions: false, pressed: 'false' },
    { captions: true, pressed: 'true' },
  ])(
    'shows the captions control pressed $pressed with captions $captions',
    async ({ captions, pressed }) => {
      const { user, onToggleCaptions } = renderControls({ captions });
      const button = within(toolbar()).getByRole('button', { name: 'Captions' });

      await user.click(button);

      expect(button).toHaveAttribute('aria-pressed', pressed);
      expect(onToggleCaptions).toHaveBeenCalledOnce();
    }
  );

  it('disables the captions control for a Short that has none', () => {
    renderControls({ captions: true, hasCaptions: false });

    const button = within(toolbar()).getByRole('button', { name: 'Captions' });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute('aria-pressed', 'false');
  });

  it('names the speed with its current rate and lists every rate to choose from', async () => {
    const { user, onSpeedChange } = renderControls({ speed: 1.5 });

    await user.click(within(toolbar()).getByRole('button', { name: 'Playback speed, 1.5x' }));
    const rates = screen.getAllByRole('menuitemradio');
    await user.click(screen.getByRole('menuitemradio', { name: '2x' }));

    expect(rates.map((rate) => rate.textContent)).toEqual([
      '0.25x',
      '0.5x',
      '0.75x',
      'Normal',
      '1.25x',
      '1.5x',
      '1.75x',
      '2x',
    ]);
    expect(onSpeedChange).toHaveBeenCalledExactlyOnceWith(2);
  });

  it('passes axe', async () => {
    renderControls();

    expect(await axeViolations()).toEqual([]);
  });
});
