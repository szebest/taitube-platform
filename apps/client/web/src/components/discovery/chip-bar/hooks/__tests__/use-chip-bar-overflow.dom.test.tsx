import { render, screen } from '@testing-library/react';
import { useRef } from 'react';
import { useChipBarOverflow } from '../use-chip-bar-overflow';

function Probe() {
  const ref = useRef<HTMLDivElement>(null);
  const { start, end } = useChipBarOverflow(ref);
  return (
    <div ref={ref} data-testid="track">
      {String(start)}/{String(end)}
    </div>
  );
}

describe('apps/client/web: useChipBarOverflow', () => {
  it('measures the track once on mount and stops observing on unmount', () => {
    const disconnect = vi.fn();
    vi.stubGlobal(
      'ResizeObserver',
      class {
        observe = vi.fn();
        disconnect = disconnect;
      }
    );

    const { unmount } = render(<Probe />);

    expect(screen.getByTestId('track')).toHaveTextContent('false/false');

    unmount();

    expect(disconnect).toHaveBeenCalledOnce();
    vi.unstubAllGlobals();
  });
});
