import { Button } from '@kit/ui';
import type { Decorator, Meta, StoryObj } from '@storybook/react-vite';
import { ActivityList, ActivityListSkeleton } from '..';

const AVATAR = `data:image/svg+xml,${encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1"><rect width="1" height="1" fill="#2f4a5c"/></svg>'
)}`;

const frame: Decorator = (Story) => (
  <div className="max-w-[36rem] p-section">
    <Story />
  </div>
);

const meta = {
  title: 'Web/ActivityList',
  tags: ['text'],
  component: ActivityList.Root,
  args: { 'aria-label': 'Activity' },
  decorators: [frame],
} satisfies Meta<typeof ActivityList.Root>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Entries: Story = {
  render: (args) => (
    <ActivityList.Root {...args}>
      <ActivityList.Item>
        <ActivityList.Avatar src={AVATAR} name="Ana Costa" />
        <ActivityList.Text>Ana Costa added Lisbon trams, no music</ActivityList.Text>
        <ActivityList.Time dateTime="2026-11-26T09:00:00Z">1 day ago</ActivityList.Time>
      </ActivityList.Item>
      <ActivityList.Item>
        <ActivityList.Avatar src={undefined} name="Bruno Lima" />
        <ActivityList.Text>Bruno Lima moved Alfama at 5 a.m. to position 2</ActivityList.Text>
        <ActivityList.Time dateTime="2026-11-25T18:30:00Z">2 days ago</ActivityList.Time>
      </ActivityList.Item>
    </ActivityList.Root>
  ),
};

export const WithRestore: Story = {
  render: (args) => (
    <ActivityList.Root {...args}>
      <ActivityList.Item>
        <ActivityList.Avatar src={AVATAR} name="Ana Costa" />
        <ActivityList.Text>Ana Costa removed Rain on the Tagus</ActivityList.Text>
        <ActivityList.Time dateTime="2026-11-26T09:00:00Z">1 day ago</ActivityList.Time>
        <ActivityList.Action>
          <Button size="sm" variant="soft">
            Restore
          </Button>
        </ActivityList.Action>
      </ActivityList.Item>
    </ActivityList.Root>
  ),
};

export const LongSentence: Story = {
  render: (args) => (
    <ActivityList.Root {...args}>
      <ActivityList.Item>
        <ActivityList.Avatar src={undefined} name="Maria" />
        <ActivityList.Text>
          Maria added The extremely patient society for night trams, wet tiles and other quiet
          things, part four of an unreasonably long series, to the section Night trams
        </ActivityList.Text>
        <ActivityList.Time dateTime="2026-11-20T09:00:00Z">1 week ago</ActivityList.Time>
        <ActivityList.Action>
          <Button size="sm" variant="soft">
            Restore
          </Button>
        </ActivityList.Action>
      </ActivityList.Item>
    </ActivityList.Root>
  ),
};

export const RightToLeft: Story = {
  globals: { direction: 'rtl' },
  render: (args) => (
    <ActivityList.Root {...args}>
      <ActivityList.Item>
        <ActivityList.Avatar src={undefined} name="منى" />
        <ActivityList.Text>أضافت منى ترام لشبونة في الليل</ActivityList.Text>
        <ActivityList.Time dateTime="2026-11-26T09:00:00Z">قبل يوم</ActivityList.Time>
        <ActivityList.Action>
          <Button size="sm" variant="soft">
            استعادة
          </Button>
        </ActivityList.Action>
      </ActivityList.Item>
    </ActivityList.Root>
  ),
};

export const Skeleton: Story = { render: () => <ActivityListSkeleton /> };
