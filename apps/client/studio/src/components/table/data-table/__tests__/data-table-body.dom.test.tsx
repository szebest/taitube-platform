import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { bodyRows, renderVideoTable } from './video-table.fixture';

describe('apps/client/studio: DataTable.Body', () => {
  it('names each row checkbox by the row it selects', () => {
    renderVideoTable();

    expect(screen.getByRole('checkbox', { name: 'Select Night bus to Porto' })).toBeInTheDocument();
  });

  it('puts one row in the tab order at a time', () => {
    renderVideoTable();

    expect(bodyRows().map((row) => row.tabIndex)).toEqual([0, -1, -1, -1, -1]);
  });

  it('moves between rows with the arrow keys', async () => {
    renderVideoTable();
    const [first, second] = bodyRows();
    first?.focus();

    await userEvent.keyboard('{ArrowDown}');

    expect(second).toHaveFocus();
    expect(second).toHaveAttribute('tabindex', '0');

    await userEvent.keyboard('{ArrowUp}');

    expect(first).toHaveFocus();
  });

  it('selects a row with Space and extends to it with Shift and Space', async () => {
    renderVideoTable();
    bodyRows()[0]?.focus();

    await userEvent.keyboard(' {ArrowDown}{ArrowDown}{Shift>} {/Shift}');

    expect(bodyRows().map((row) => row.getAttribute('aria-selected'))).toEqual([
      'true',
      'true',
      'true',
      'false',
      'false',
    ]);
    expect(screen.getByRole('status')).toHaveTextContent('3 selected');
  });

  it('activates the focused row with Enter', async () => {
    const onRowActivate = vi.fn();
    renderVideoTable({ onRowActivate });
    bodyRows()[1]?.focus();

    await userEvent.keyboard('{Enter}');

    expect(onRowActivate).toHaveBeenCalledWith('porto');
  });

  it('selects a row from its checkbox', async () => {
    renderVideoTable();

    await userEvent.click(screen.getByRole('checkbox', { name: 'Select Harbour at dawn' }));

    expect(bodyRows()[2]).toHaveAttribute('aria-selected', 'true');
  });

  it('draws ten skeleton rows under the real header while loading', () => {
    renderVideoTable({ state: 'loading' });

    expect(screen.getByRole('button', { name: 'Title not sorted' })).toBeInTheDocument();
    expect(document.querySelectorAll('[data-slot="data-table-skeleton-row"]')).toHaveLength(10);
  });

  it.each([
    { state: 'empty' as const, message: 'No videos yet' },
    { state: 'error' as const, message: 'Could not load your videos' },
  ])('shows the caller’s child across every column when $state', ({ state, message }) => {
    renderVideoTable({ state, message: <p>{message}</p> });

    const cell = within(bodyRows()[0] as HTMLElement).getByRole('cell');

    expect(cell).toHaveTextContent(message);
    expect(cell).toHaveAttribute('colspan', '4');
    expect(screen.getByRole('button', { name: 'Views not sorted' })).toBeInTheDocument();
  });

  it('aligns a numeric column at the end in tabular figures', () => {
    renderVideoTable();

    const views = within(bodyRows()[0] as HTMLElement).getByRole('cell', { name: '412008' });

    expect(views).toHaveClass('tw:tabular-nums', 'tw:text-end');
  });
});
