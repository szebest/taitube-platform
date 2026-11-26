import type { Meta, StoryObj } from '@storybook/react-vite';
import { FALLBACK_ACTIVE_LOCALE, IntlProvider } from '@vp/queries/intl';
import { STUDIO_MESSAGES } from '#app/lib/messages';
import { RevisionList, type RevisionListItem } from '../index';

const items: RevisionListItem[] = [
  {
    id: 'a',
    version: 4,
    createdAt: '2026-03-04T12:00:00.000Z',
    restoredFromVersion: null,
    changedFields: ['title', 'tags'],
    current: true,
  },
  {
    id: 'b',
    version: 3,
    createdAt: '2026-03-03T12:00:00.000Z',
    restoredFromVersion: 1,
    changedFields: ['chapters'],
    current: false,
  },
  {
    id: 'c',
    version: 1,
    createdAt: '2026-03-01T12:00:00.000Z',
    restoredFromVersion: null,
    changedFields: null,
    current: false,
  },
];

const meta = {
  title: 'Studio/RevisionList',
  component: RevisionList,
  args: { 'aria-label': 'Versions of this video', items, onRestore: () => {} },
  render: (args) => (
    <IntlProvider
      messages={STUDIO_MESSAGES}
      locale={FALLBACK_ACTIVE_LOCALE.locale}
      catalogues={FALLBACK_ACTIVE_LOCALE.catalogues}
      timeZone="UTC"
    >
      <RevisionList {...args} />
    </IntlProvider>
  ),
} satisfies Meta<typeof RevisionList>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Idle: Story = {};

export const Restoring: Story = { args: { pending: true } };
