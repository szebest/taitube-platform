import type { Meta, StoryObj } from '@storybook/react-vite';
import { EmptyState, NoNotificationsIllustration, SectionError } from '@vp/components';
import { Icon, Skeleton as SkeletonBar, Tabs } from '@vp/ui';
import type { ReactNode } from 'react';
import { NotificationCentre, NotificationCentreSkeleton } from '.';
import { NotificationCentreRoot, type NotificationCentreRootProps } from './notification-centre';

const AVATAR =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 8 8'%3E%3Crect width='8' height='8' fill='%23c9a66b'/%3E%3C/svg%3E";
const FRAME =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 9'%3E%3Crect width='16' height='9' fill='%23263238'/%3E%3Ccircle cx='11' cy='6' r='2.5' fill='%23c9a66b'/%3E%3C/svg%3E";

const meta = {
  title: 'Web/NotificationCentre',
  component: NotificationCentreRoot,
  tags: ['motion'],
  parameters: { layout: 'fullscreen' },
  args: { open: true, onOpenChange: () => undefined },
} satisfies Meta<typeof NotificationCentreRoot>;

export default meta;

type Story = StoryObj<typeof meta>;

const select = () => undefined;

function Centre({ args, children }: { args: NotificationCentreRootProps; children: ReactNode }) {
  return (
    <div className="tw:flex tw:justify-end tw:p-inset-card">
      <NotificationCentre.Root {...args}>
        <NotificationCentre.Trigger />
        <NotificationCentre.Panel>
          <NotificationCentre.Header>
            <NotificationCentre.MarkAllRead />
          </NotificationCentre.Header>
          <Tabs.Root
            defaultValue="all"
            size="sm"
            className="tw:flex tw:min-h-0 tw:flex-1 tw:flex-col"
          >
            <NotificationCentre.Filters>
              <Tabs.List aria-label="Show">
                <Tabs.Tab value="all">All</Tabs.Tab>
                <Tabs.Tab value="subscriptions">Subscriptions</Tabs.Tab>
                <Tabs.Tab value="replies">Replies</Tabs.Tab>
              </Tabs.List>
            </NotificationCentre.Filters>
            <Tabs.Panel value="all" className="tw:flex tw:min-h-0 tw:flex-1 tw:flex-col">
              {children}
            </Tabs.Panel>
          </Tabs.Root>
        </NotificationCentre.Panel>
      </NotificationCentre.Root>
    </div>
  );
}

function Items({ thumbnails = false }: { thumbnails?: boolean }) {
  const thumbnail = thumbnails ? FRAME : undefined;

  return (
    <NotificationCentre.Body>
      <NotificationCentre.Group heading="Today">
        <NotificationCentre.Item
          unread
          avatarSrc={AVATAR}
          time="2 hours ago"
          thumbnailSrc={thumbnail}
          onSelect={select}
        >
          Lisbon Walks uploaded "Alfama at 5 a.m., before the trams"
        </NotificationCentre.Item>
        <NotificationCentre.Item unread avatarSrc={AVATAR} time="4 hours ago" onSelect={select}>
          Marta Reis replied to your comment: "The camcorder was my father's."
        </NotificationCentre.Item>
        <NotificationCentre.Item
          unread
          avatarSrc={AVATAR}
          time="6 hours ago"
          thumbnailSrc={thumbnail}
          onSelect={select}
        >
          Fado Nights is live now
        </NotificationCentre.Item>
      </NotificationCentre.Group>
      <NotificationCentre.Group heading="This week">
        <NotificationCentre.Item time="3 days ago" thumbnailSrc={thumbnail} onSelect={select}>
          Your video "Lisbon at night" passed 10,000 views
        </NotificationCentre.Item>
      </NotificationCentre.Group>
    </NotificationCentre.Body>
  );
}

export const Empty: Story = {
  render: (args) => (
    <Centre args={args}>
      <NotificationCentre.Body>
        <EmptyState.Root size="section">
          <EmptyState.Illustration>
            <NoNotificationsIllustration />
          </EmptyState.Illustration>
          <EmptyState.Title asChild>
            <h3>No notifications yet</h3>
          </EmptyState.Title>
          <EmptyState.Description>
            New uploads from channels you follow and replies to you will land here.
          </EmptyState.Description>
          <EmptyState.Action asChild>
            <a href="/subscriptions">Manage subscriptions</a>
          </EmptyState.Action>
        </EmptyState.Root>
      </NotificationCentre.Body>
    </Centre>
  ),
};

export const GroupedWithThreeUnread: Story = {
  args: { unread: '3' },
  render: (args) => (
    <Centre args={args}>
      <Items />
    </Centre>
  ),
};

export const WithThumbnails: Story = {
  args: { unread: '3' },
  render: (args) => (
    <Centre args={args}>
      <Items thumbnails />
    </Centre>
  ),
};

export const Loading: Story = {
  render: (args) => (
    <Centre args={args}>
      <NotificationCentre.Body aria-busy="true">
        {['first', 'second', 'third', 'fourth', 'fifth'].map((row) => (
          <div
            key={row}
            className="tw:flex tw:h-[4.5rem] tw:items-center tw:gap-stack tw:px-inset-card"
          >
            <SkeletonBar shape="circle" className="tw:size-control-md tw:shrink-0" />
            <div className="tw:flex tw:flex-1 tw:flex-col tw:gap-inline">
              <SkeletonBar shape="text" className="tw:w-full" />
              <SkeletonBar shape="text" className="tw:w-[60%]" />
            </div>
          </div>
        ))}
      </NotificationCentre.Body>
    </Centre>
  ),
};

export const Failed: Story = {
  render: (args) => (
    <Centre args={args}>
      <NotificationCentre.Body>
        <SectionError.Root layout="bar" onRetry={() => undefined}>
          <SectionError.Message>Notifications did not load.</SectionError.Message>
        </SectionError.Root>
      </NotificationCentre.Body>
    </Centre>
  ),
};

export const Offline: Story = {
  args: { unread: '3' },
  render: (args) => (
    <Centre args={args}>
      <NotificationCentre.Notice>
        <Icon name="wifi-off" size="sm" />
        You are offline. These were saved earlier.
      </NotificationCentre.Notice>
      <Items />
    </Centre>
  ),
};

export const ManyUnread: Story = {
  args: { unread: '9+', open: false },
  render: (args) => (
    <Centre args={args}>
      <Items />
    </Centre>
  ),
};

export const CompactSheet: Story = {
  args: { layout: 'sheet', unread: '3' },
  render: (args) => (
    <Centre args={args}>
      <Items />
    </Centre>
  ),
};

export const Skeleton: Story = {
  render: () => <NotificationCentreSkeleton />,
};
