import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderVideoTable, shownTitles } from './video-table.fixture';

describe('apps/client/studio: DataTable.Pagination', () => {
  it('shows the caller’s range beside the page controls', () => {
    renderVideoTable();

    expect(screen.getByText('1 to 5 of 5')).toBeInTheDocument();
  });

  it('pages forward and back', async () => {
    renderVideoTable({ pageSize: 2 });

    expect(screen.getByText('Page 1 of 3')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Previous page' })).toBeDisabled();

    await userEvent.click(screen.getByRole('button', { name: 'Next page' }));

    expect(screen.getByText('Page 2 of 3')).toBeInTheDocument();
    expect(shownTitles()).toEqual(['Harbour at dawn', 'Tram 28, end to end']);

    await userEvent.click(screen.getByRole('button', { name: 'Previous page' }));

    expect(screen.getByText('Page 1 of 3')).toBeInTheDocument();
  });

  it('changes the page size from its menu', async () => {
    renderVideoTable({ pageSize: 2 });

    await userEvent.click(screen.getByRole('button', { name: 'Rows per page 2' }));
    await userEvent.click(await screen.findByRole('menuitemradio', { name: '50' }));

    expect(screen.getByText('Page 1 of 1')).toBeInTheDocument();
    expect(shownTitles()).toHaveLength(5);
  });
});
