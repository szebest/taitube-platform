import type { Meta, StoryObj } from '@storybook/react-vite';
import { FilterSelect } from '../filter-select';

const meta = {
  title: 'Studio/FilterSelect',
  component: FilterSelect,
  args: {
    label: 'Action',
    value: undefined,
    options: [
      { value: 'invite.created', label: 'Invite sent' },
      { value: 'member.removed', label: 'Member removed' },
    ],
    onChange: () => undefined,
  },
} satisfies Meta<typeof FilterSelect<string>>;

export default meta;

type Story = StoryObj<typeof meta>;

export const NoFilter: Story = {};

export const Filtered: Story = { args: { value: 'member.removed' } };
