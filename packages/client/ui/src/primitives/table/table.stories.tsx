import type { Meta, StoryObj } from '@storybook/react-vite';
import { variantNames } from '../../lib/variant-names';
import { Button } from '../button';
import { Table } from '.';
import { TableRoot } from './table';
import { tableStyles } from './table.variants';

const meta = {
  title: 'Primitives/Table',
  component: TableRoot,
} satisfies Meta<typeof TableRoot>;

export default meta;

type Story = StoryObj<typeof meta>;

const VIDEOS = [
  { title: 'Shot entirely on a 1998 camcorder: Lisbon at night', views: '1,204' },
  { title: 'Harbour at dawn', views: '880' },
  { title: 'Tram 28, end to end', views: '12,430' },
  { title: 'Marta Reis Films: the making of', views: '96' },
];

const Videos = (props: { size: 'sm' | 'md' }) => (
  <Table.Root size={props.size}>
    <Table.Caption>Your videos ({props.size})</Table.Caption>
    <Table.Header>
      <Table.Row>
        <Table.Head>Title</Table.Head>
        <Table.Head align="end" aria-sort="descending">
          <Button variant="ghost" size="sm">
            Views
          </Button>
        </Table.Head>
      </Table.Row>
    </Table.Header>
    <Table.Body>
      {VIDEOS.map((video, index) => (
        <Table.Row key={video.title} selected={index === 1}>
          <Table.Cell>{video.title}</Table.Cell>
          <Table.Cell align="end">{video.views}</Table.Cell>
        </Table.Row>
      ))}
    </Table.Body>
    <Table.Footer>
      <Table.Row>
        <Table.Cell>Total</Table.Cell>
        <Table.Cell align="end">14,610</Table.Cell>
      </Table.Row>
    </Table.Footer>
  </Table.Root>
);

export const Sizes: Story = {
  render: () => (
    <div className="tw:flex tw:flex-col tw:gap-section tw:p-section">
      {variantNames(tableStyles.variants.size).map((size) => (
        <Videos key={size} size={size} />
      ))}
    </div>
  ),
};
