import { render, screen } from '@testing-library/react';
import { useRef } from 'react';

import { useWindowRows } from '../use-window-rows';

const ROW_HEIGHT = 100;

function Rows({ count }: { count: number }) {
  const list = useRef<HTMLUListElement>(null);
  const { rows, padding, measureRow } = useWindowRows({
    list,
    rowCount: count,
    estimateRowHeight: ROW_HEIGHT,
    getRowKey: String,
  });

  return (
    <ul ref={list} style={padding}>
      {rows.map(({ index, key }) => (
        <li key={key} ref={measureRow} data-index={index}>
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
});
