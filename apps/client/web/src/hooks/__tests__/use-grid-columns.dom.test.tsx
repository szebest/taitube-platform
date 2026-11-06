import { render, screen } from '@testing-library/react';
import { type CSSProperties, useRef } from 'react';

import { useGridColumns } from '../use-grid-columns';

function Grid() {
  const list = useRef<HTMLUListElement>(null);
  const columns = useGridColumns(list);

  return (
    <ul ref={list} style={{ columnGap: '20px', '--layout-card-min': '200px' } as CSSProperties}>
      <li>{columns} columns</li>
    </ul>
  );
}

const renderGridOf = (width: number) => {
  vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(width);
  return render(<Grid />);
};

describe('apps/client/web: useGridColumns', () => {
  it.each([
    { width: 1000, columns: 4 },
    { width: 460, columns: 2 },
    { width: 100, columns: 1 },
  ])('fits $columns columns of 200px and a 20px gap into $width px', ({ width, columns }) => {
    renderGridOf(width);

    expect(screen.getByText(`${columns} columns`)).toBeInTheDocument();
  });

  it('keeps the default while the list has no width yet', () => {
    renderGridOf(0);

    expect(screen.getByText('4 columns')).toBeInTheDocument();
  });
});
