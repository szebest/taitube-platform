import { render, screen } from '@testing-library/react';
import { axeViolations } from '@vp/web-testing/dom';
import { Table } from '..';
import type { TableRootProps } from '../table';
import type { TableAlign } from '../types';

const renderVideoTable = (props: TableRootProps = {}, selected = false) =>
  render(
    <Table.Root {...props}>
      <Table.Caption>Your videos</Table.Caption>
      <Table.Header>
        <Table.Row>
          <Table.Head>Title</Table.Head>
          <Table.Head align="end" aria-sort="descending">
            Views
          </Table.Head>
        </Table.Row>
      </Table.Header>
      <Table.Body>
        <Table.Row selected={selected}>
          <Table.Cell asChild>
            <th scope="row">Lisbon at night</th>
          </Table.Cell>
          <Table.Cell align="end">1,204</Table.Cell>
        </Table.Row>
      </Table.Body>
      <Table.Footer>
        <Table.Row>
          <Table.Cell colSpan={2}>1 video</Table.Cell>
        </Table.Row>
      </Table.Footer>
    </Table.Root>
  );

describe('@vp/ui: Table', () => {
  it('is a native table named by its caption, with column and row headers', () => {
    renderVideoTable();

    expect(screen.getByRole('table', { name: 'Your videos' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Title' })).toHaveAttribute('scope', 'col');
    expect(screen.getByRole('columnheader', { name: 'Views' })).toHaveAttribute(
      'aria-sort',
      'descending'
    );
    expect(screen.getByRole('rowheader', { name: 'Lisbon at night' })).toBeInTheDocument();
  });

  it.each([
    { size: 'sm', row: 'tw:h-control-sm' },
    { size: 'md', row: 'tw:h-control-md' },
  ] as const)('sets the row height from size $size', ({ size, row }) => {
    renderVideoTable({ size });

    expect(screen.getByRole('cell', { name: '1,204' })).toHaveClass(row);
  });

  it.each([
    { align: 'start', cls: 'tw:text-start' },
    { align: 'center', cls: 'tw:text-center' },
    { align: 'end', cls: 'tw:text-end' },
  ] satisfies { align: TableAlign; cls: string }[])(
    'aligns a cell to the $align',
    ({ align, cls }) => {
      render(
        <Table.Root aria-label="Aligned">
          <Table.Body>
            <Table.Row>
              <Table.Cell align={align}>Value</Table.Cell>
            </Table.Row>
          </Table.Body>
        </Table.Root>
      );

      expect(screen.getByRole('cell', { name: 'Value' })).toHaveClass(cls);
    }
  );

  it('pins its header only when asked, and marks a selected row', () => {
    renderVideoTable({ stickyHeader: true }, true);

    expect(screen.getByRole('columnheader', { name: 'Title' })).toHaveClass('tw:sticky');
    expect(screen.getByRole('row', { name: /Lisbon at night/ })).toHaveAttribute(
      'aria-selected',
      'true'
    );
  });

  it('passes axe', async () => {
    renderVideoTable();

    expect(await axeViolations()).toEqual([]);
  });
});
