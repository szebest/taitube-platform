import type { Meta, StoryObj } from '@storybook/react-vite';
import { RoleBadge } from '../../role-badge';
import { AuditLogListRoot } from '../audit-log-list';
import { AuditLogList } from '../index';

const meta = {
  title: 'Studio/AuditLogList',
  component: AuditLogListRoot,
  args: { 'aria-label': 'Audit log entries', className: 'w-[36rem]' },
  render: (args) => (
    <AuditLogListRoot {...args}>
      <AuditLogList.Item>
        <AuditLogList.Avatar name="Ada" />
        <AuditLogList.Body>
          <AuditLogList.Actor>Ada</AuditLogList.Actor>
          <AuditLogList.Action>
            Invited someone <RoleBadge channelRole="editor">Editor</RoleBadge>
          </AuditLogList.Action>
        </AuditLogList.Body>
        <AuditLogList.Time dateTime="2026-01-01T00:00:00.000Z">2 days ago</AuditLogList.Time>
      </AuditLogList.Item>
      <AuditLogList.Item>
        <AuditLogList.Avatar name="Grace" />
        <AuditLogList.Body>
          <AuditLogList.Actor>Grace</AuditLogList.Actor>
          <AuditLogList.Action>Edited a video</AuditLogList.Action>
          <AuditLogList.Detail>title and tags</AuditLogList.Detail>
        </AuditLogList.Body>
        <AuditLogList.Time dateTime="2026-01-01T00:00:00.000Z">3 hours ago</AuditLogList.Time>
      </AuditLogList.Item>
    </AuditLogListRoot>
  ),
} satisfies Meta<typeof AuditLogListRoot>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Entries: Story = {};

export const Single: Story = {
  render: (args) => (
    <AuditLogListRoot {...args}>
      <AuditLogList.Item>
        <AuditLogList.Avatar name="Ada" />
        <AuditLogList.Body>
          <AuditLogList.Actor>Ada</AuditLogList.Actor>
          <AuditLogList.Action>Left the team</AuditLogList.Action>
        </AuditLogList.Body>
        <AuditLogList.Time dateTime="2026-01-01T00:00:00.000Z">just now</AuditLogList.Time>
      </AuditLogList.Item>
    </AuditLogListRoot>
  ),
};
