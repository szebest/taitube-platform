import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { enterAtFirstItem, moveFocus } from '../chip-bar-keyboard';

const renderTrack = (multiple: boolean) => {
  const onClick = vi.fn();
  render(
    <div
      role="listbox"
      aria-label="Track"
      tabIndex={0}
      onKeyDown={(event) => moveFocus(event, multiple)}
      onFocus={enterAtFirstItem}
    >
      {['a', 'b', 'c'].map((name) => (
        <button
          key={name}
          type="button"
          data-slot="chip-bar-item"
          aria-disabled={name === 'b' || undefined}
          onClick={() => onClick(name)}
        >
          {name}
        </button>
      ))}
    </div>
  );
  return { onClick, user: userEvent.setup() };
};

describe('apps/client/web: chip-bar.keyboard', () => {
  it('moves focus from the track itself to the first enabled item', async () => {
    const { user } = renderTrack(true);

    await user.tab();

    expect(screen.getByRole('button', { name: 'a' })).toHaveFocus();
  });

  it.each([
    { key: '{ArrowRight}', focused: 'c' },
    { key: '{ArrowLeft}', focused: 'c' },
    { key: '{End}', focused: 'c' },
    { key: '{Home}', focused: 'a' },
  ])('$key lands on $focused, skipping the disabled item', async ({ key, focused }) => {
    const { user } = renderTrack(true);
    screen.getByRole('button', { name: 'a' }).focus();

    await user.keyboard(key);

    expect(screen.getByRole('button', { name: focused })).toHaveFocus();
  });

  it.each([
    { multiple: false, clicks: 1 },
    { multiple: true, clicks: 0 },
  ])('clicks the target on arrows when multiple is $multiple', async ({ multiple, clicks }) => {
    const { onClick, user } = renderTrack(multiple);
    screen.getByRole('button', { name: 'a' }).focus();

    await user.keyboard('{ArrowRight}');

    expect(onClick).toHaveBeenCalledTimes(clicks);
  });
});
