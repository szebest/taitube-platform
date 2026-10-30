import { render, screen } from '@testing-library/react';
import { axeViolations } from '@vp/web-testing/dom';
import { DataTable } from '..';
import { renderVideoTable } from './video-table.fixture';

describe('apps/client/studio: DataTable', () => {
  it('names the table by its visually hidden caption', () => {
    renderVideoTable();

    expect(screen.getByRole('table', { name: 'Your videos' })).toBeInTheDocument();
  });

  it('keeps the toolbar in use while nothing is selected', () => {
    renderVideoTable();

    expect(screen.getByRole('textbox', { name: 'Filter by title' })).not.toHaveAttribute('inert');
    expect(document.querySelector('[data-slot="data-table-batch"]')).toHaveAttribute(
      'data-state',
      'closed'
    );
    expect(screen.getByRole('status')).toHaveTextContent('');
  });

  it('shows the batch bar over the toolbar and announces the count once rows are selected', () => {
    renderVideoTable({ selected: ['lisbon', 'porto'] });

    expect(screen.getByRole('status')).toHaveTextContent('2 selected');
    expect(screen.getByRole('button', { name: 'Delete' })).toBeVisible();
    expect(document.querySelector('[data-slot="data-table-toolbar"]')).toHaveAttribute('inert');
  });

  it.each([
    { scenario: 'a refetch', props: { fetching: true }, busy: 'true' },
    { scenario: 'the first load', props: { state: 'loading' as const }, busy: 'true' },
    { scenario: 'loaded rows', props: {}, busy: 'false' },
  ])('says whether it is busy for $scenario', ({ props, busy }) => {
    renderVideoTable(props);

    expect(screen.getByRole('table')).toHaveAttribute('aria-busy', busy);
  });

  it('asks for its root around a part', () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);

    expect(() => render(<DataTable.Toolbar />)).toThrow(
      'DataTable.Toolbar must be inside DataTable.Root'
    );
  });

  it.each([
    { scenario: 'loaded', props: {} },
    { scenario: 'with rows selected', props: { selected: ['lisbon'] } },
    { scenario: 'refetching', props: { fetching: true } },
    { scenario: 'loading', props: { state: 'loading' as const } },
    { scenario: 'empty', props: { state: 'empty' as const, message: <p>No videos yet</p> } },
  ])('passes axe $scenario', async ({ props }) => {
    renderVideoTable(props);

    expect(await axeViolations()).toEqual([]);
  });
});
