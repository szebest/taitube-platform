import { render } from '@testing-library/react';
import { axeViolations } from '@vp/web-testing/dom';
import { DataTableSkeleton } from '..';
import { VIDEO_COLUMNS } from './video-table.fixture';

const renderSkeleton = (selectable?: boolean) =>
  render(<DataTableSkeleton columns={VIDEO_COLUMNS} selectable={selectable} />);

describe('apps/client/studio: DataTableSkeleton', () => {
  it('draws a header and ten rows, hidden from assistive technology', () => {
    renderSkeleton();

    const skeleton = document.querySelector('[data-slot="data-table-skeleton"]');

    expect(skeleton).toHaveAttribute('aria-hidden', 'true');
    expect(skeleton?.querySelectorAll('tbody tr')).toHaveLength(10);
  });

  it('sizes each cell at the width its column declares', () => {
    renderSkeleton();

    const widths = [...document.querySelectorAll<HTMLElement>('thead td')].map(
      (cell) => cell.style.width
    );

    expect(widths).toEqual(['', '55%', '20%', '25%']);
  });

  it.each([
    { selectable: true, cells: 4 },
    { selectable: false, cells: 3 },
  ])('draws $cells cells a row when selectable is $selectable', ({ selectable, cells }) => {
    renderSkeleton(selectable);

    expect(document.querySelectorAll('tbody tr:first-child td')).toHaveLength(cells);
  });

  it('passes axe', async () => {
    renderSkeleton();

    expect(await axeViolations()).toEqual([]);
  });
});
