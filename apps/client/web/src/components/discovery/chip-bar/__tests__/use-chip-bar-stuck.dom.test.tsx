import { act, render, screen } from '@testing-library/react';
import { useRef } from 'react';
import { useChipBarStuck } from '../use-chip-bar-stuck';

function Probe() {
  const ref = useRef<HTMLDivElement>(null);
  const stuck = useChipBarStuck(ref);
  return (
    <div ref={ref} data-testid="root" style={{ top: '10px' }}>
      {String(stuck)}
    </div>
  );
}

describe('apps/client/web: useChipBarStuck', () => {
  it.each([
    { name: 'pinned and scrolled', scrollY: 40, top: 10, expected: 'true' },
    { name: 'at the top of the page', scrollY: 0, top: 10, expected: 'false' },
    { name: 'not yet at its pin', scrollY: 40, top: 80, expected: 'false' },
  ])('is $expected when $name', ({ scrollY, top, expected }) => {
    vi.spyOn(window, 'scrollY', 'get').mockReturnValue(scrollY);
    render(<Probe />);
    const root = screen.getByTestId('root');
    vi.spyOn(root, 'getBoundingClientRect').mockReturnValue({ top } as DOMRect);

    act(() => {
      window.dispatchEvent(new Event('scroll'));
    });

    expect(root).toHaveTextContent(expected);
  });
});
