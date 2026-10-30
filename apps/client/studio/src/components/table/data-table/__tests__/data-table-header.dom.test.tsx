import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderVideoTable, shownTitles } from './video-table.fixture';

describe('apps/client/studio: DataTable.Header', () => {
  it.each([
    { sorting: [], button: 'Views not sorted', ariaSort: null },
    {
      sorting: [{ id: 'views', desc: true }],
      button: 'Views sorted descending',
      ariaSort: 'descending',
    },
    {
      sorting: [{ id: 'views', desc: false }],
      button: 'Views sorted ascending',
      ariaSort: 'ascending',
    },
  ])('names the sort button "$button"', ({ sorting, button, ariaSort }) => {
    renderVideoTable({ sorting });

    const sort = screen.getByRole('button', { name: button });

    expect(sort.closest('th')?.getAttribute('aria-sort') ?? null).toBe(ariaSort);
  });

  it('sorts by a column when its button is pressed', async () => {
    renderVideoTable();

    await userEvent.click(screen.getByRole('button', { name: 'Title not sorted' }));

    expect(screen.getByRole('columnheader', { name: /Title/ })).toHaveAttribute(
      'aria-sort',
      'ascending'
    );
    expect(shownTitles()[0]).toBe('Harbour at dawn');
  });

  it('leaves a column that does not sort without a button', () => {
    renderVideoTable();

    const status = screen.getByRole('columnheader', { name: 'Status' });

    expect(within(status).queryByRole('button')).not.toBeInTheDocument();
  });

  it.each([
    { scenario: 'none', selected: [], checked: 'false' },
    { scenario: 'some', selected: ['lisbon'], checked: 'mixed' },
    {
      scenario: 'every',
      selected: ['lisbon', 'porto', 'harbour', 'tram', 'making-of'],
      checked: 'true',
    },
  ])('draws the select-all box for $scenario of the rows selected', ({ selected, checked }) => {
    renderVideoTable({ selected });

    expect(screen.getByRole('checkbox', { name: 'Select all rows' })).toHaveAttribute(
      'aria-checked',
      checked
    );
  });

  it('selects every row on the page from the head checkbox', async () => {
    renderVideoTable();

    await userEvent.click(screen.getByRole('checkbox', { name: 'Select all rows' }));

    expect(screen.getByRole('status')).toHaveTextContent('5 selected');
  });

  it('drops the selection column from a table that does not select', () => {
    renderVideoTable({ selectable: false });

    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
  });

  it.each([
    { fetching: true, strips: 1 },
    { fetching: false, strips: 0 },
  ])(
    'draws $strips accent strip under the header when fetching is $fetching',
    ({ fetching, strips }) => {
      renderVideoTable({ fetching });

      expect(document.querySelectorAll('thead [data-slot="data-table-fetching"]')).toHaveLength(
        strips
      );
    }
  );
});
