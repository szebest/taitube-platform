import type { Meta, StoryObj } from '@storybook/react-vite';
import { FALLBACK_ACTIVE_LOCALE, IntlProvider } from '@vp/intl-react';
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
  render: (args) => (
    <IntlProvider
      locale={FALLBACK_ACTIVE_LOCALE.locale}
      catalogues={FALLBACK_ACTIVE_LOCALE.catalogues}
      timeZone="UTC"
    >
      <FilterSelect {...args} />
    </IntlProvider>
  ),
} satisfies Meta<typeof FilterSelect<string>>;

export default meta;

type Story = StoryObj<typeof meta>;

export const NoFilter: Story = {};

export const Filtered: Story = { args: { value: 'member.removed' } };
