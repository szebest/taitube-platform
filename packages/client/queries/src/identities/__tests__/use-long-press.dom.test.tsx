import { fireEvent, render, screen } from '@testing-library/react';
import { useLongPress } from '../use-long-press';

function Pressable({ onLongPress }: { onLongPress: () => void }) {
  return (
    <button type="button" {...useLongPress(onLongPress)}>
      You
    </button>
  );
}

describe('@vp/queries: useLongPress', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it.each([
    { held: 500, release: false, called: true },
    { held: 499, release: true, called: false },
  ])('after $held ms held calls back: $called', ({ held, release, called }) => {
    const onLongPress = vi.fn();
    render(<Pressable onLongPress={onLongPress} />);
    const button = screen.getByRole('button');

    fireEvent.pointerDown(button, { button: 0 });
    vi.advanceTimersByTime(held);
    if (release) fireEvent.pointerUp(button);
    vi.advanceTimersByTime(1000);

    expect(onLongPress).toHaveBeenCalledTimes(called ? 1 : 0);
  });

  it('keeps the browser menu off a touch long press', () => {
    render(<Pressable onLongPress={vi.fn()} />);
    const event = new PointerEvent('contextmenu', {
      bubbles: true,
      cancelable: true,
      pointerType: 'touch',
    });

    screen.getByRole('button').dispatchEvent(event);

    expect(event.defaultPrevented).toBe(true);
  });
});
