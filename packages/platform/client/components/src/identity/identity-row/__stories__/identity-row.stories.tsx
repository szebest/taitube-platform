import type { Meta, StoryObj } from '@storybook/react-vite';
import { IdentityRow } from '..';

const meta = {
  title: 'Components/IdentityRow',
  component: IdentityRow.Root,
} satisfies Meta<typeof IdentityRow.Root>;

export default meta;

type Story = StoryObj<typeof meta>;

const ROWS = [
  {
    name: 'Ada Lovelace',
    initials: 'AL',
    detail: '@ada',
    accent: 1,
    current: true,
    expired: false,
    unread: undefined,
  },
  {
    name: 'Analytical Engines',
    initials: 'AE',
    detail: '@engines',
    accent: 3,
    current: false,
    expired: false,
    unread: '4',
  },
  {
    name: 'Byron Reads',
    initials: 'BR',
    detail: 'Session expired, sign in',
    accent: 5,
    current: false,
    expired: true,
    unread: undefined,
  },
] as const;

export const States: Story = {
  render: () => (
    <ul className="m-0 flex w-72 list-none flex-col gap-stack p-stack">
      {ROWS.map((row) => (
        <li key={row.name}>
          <IdentityRow.Root current={row.current} expired={row.expired}>
            <IdentityRow.Avatar initials={row.initials} accent={row.accent} />
            <IdentityRow.Text>
              <IdentityRow.Name>{row.name}</IdentityRow.Name>
              <IdentityRow.Detail>{row.detail}</IdentityRow.Detail>
            </IdentityRow.Text>
            {row.unread && <IdentityRow.Unread>{row.unread}</IdentityRow.Unread>}
            <IdentityRow.Check />
          </IdentityRow.Root>
        </li>
      ))}
    </ul>
  ),
};
