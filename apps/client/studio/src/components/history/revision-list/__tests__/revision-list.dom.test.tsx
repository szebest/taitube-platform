import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axeViolations } from '@vp/web-testing/dom';
import { AppProviders } from '#app/__tests__/providers';
import { RevisionList, type RevisionListItem } from '../revision-list';

const item = (patch: Partial<RevisionListItem>): RevisionListItem => ({
  id: 'r',
  version: 1,
  createdAt: '2026-03-01T12:00:00.000Z',
  restoredFromVersion: null,
  changedFields: [],
  current: false,
  ...patch,
});

const items = [
  item({ id: 'a', version: 3, current: true, changedFields: ['title', 'tags'] }),
  item({ id: 'b', version: 2, changedFields: [], restoredFromVersion: 1 }),
  item({ id: 'c', version: 1, changedFields: null }),
];

function renderList(props: Partial<React.ComponentProps<typeof RevisionList>> = {}) {
  const onRestore = vi.fn();
  render(<RevisionList aria-label="Versions" items={items} onRestore={onRestore} {...props} />, {
    wrapper: AppProviders,
  });
  return {
    onRestore,
    rows: within(screen.getByRole('list', { name: 'Versions' })).getAllByRole('listitem'),
  };
}

describe('apps/client/studio: RevisionList', () => {
  it.each([
    { row: 0, text: 'Version 3' },
    { row: 0, text: 'Current' },
    { row: 0, text: 'title and tags' },
    { row: 1, text: 'Restored from version 1' },
    { row: 1, text: 'No field differs from the version before it' },
    { row: 2, text: 'Before the first edit' },
  ])('shows "$text" on row $row', ({ row, text }) => {
    const { rows } = renderList();

    expect(rows[row]).toHaveTextContent(text);
  });

  it('offers a restore on every version but the current one', () => {
    renderList();

    expect(screen.getAllByRole('button').map((button) => button.textContent)).toEqual([
      'Restore version 2',
      'Restore version 1',
    ]);
  });

  it('hands the chosen version to onRestore', async () => {
    const { onRestore } = renderList();

    await userEvent.click(screen.getByRole('button', { name: 'Restore version 2' }));

    expect(onRestore).toHaveBeenCalledWith(items[1]);
  });

  it('waits while a restore is running', () => {
    renderList({ pending: true });

    expect(screen.getAllByRole('button').every((button) => button.hasAttribute('disabled'))).toBe(
      true
    );
  });

  it('has no accessibility violations', async () => {
    render(<RevisionList aria-label="Versions" items={items} onRestore={vi.fn()} />, {
      wrapper: AppProviders,
    });

    expect(await axeViolations()).toEqual([]);
  });
});
