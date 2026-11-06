import { render, screen } from '@testing-library/react';
import { useRef } from 'react';
import { useWindowRows } from '../use-window-rows';

const ROW_HEIGHT = 100;

function Rows({ count, pinned = [] }: { count: number; pinned?: number[] }) {
  const list = useRef<HTMLUListElement>(null);
  const { rows, padding, measureRow } = useWindowRows({
    list,
    rowCount: count,
    estimateRowHeight: ROW_HEIGHT,
    getRowKey: String,
    pinned,
  });

  return (
    <ul ref={list} style={padding}>
      {rows.map(({ index, key, spaceBefore }) => (
        <li key={key} ref={measureRow} data-index={index} style={{ marginTop: spaceBefore }}>
          Row {index}
        </li>
      ))}
    </ul>
  );
}

describe('apps/client/web: useWindowRows', () => {
  it('mounts only the rows near the viewport', () => {
    vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockReturnValue(ROW_HEIGHT);
    render(<Rows count={2000} />);

    expect(screen.getAllByRole('listitem').length).toBeLessThan(50);
    expect(screen.getByText('Row 0')).toBeInTheDocument();
  });

  it('keeps a pinned row mounted far from the viewport, with the space it skips as a margin', () => {
    vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockReturnValue(ROW_HEIGHT);
    render(<Rows count={2000} pinned={[1500]} />);

    expect(screen.getByText('Row 1500')).toBeInTheDocument();
    expect(Number.parseFloat(screen.getByText('Row 1500').style.marginTop)).toBeGreaterThan(10_000);
    expect(screen.getAllByRole('listitem').length).toBeLessThan(50);
  });
});
