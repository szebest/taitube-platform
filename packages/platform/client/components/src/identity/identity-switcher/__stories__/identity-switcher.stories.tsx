import type { Meta, StoryObj } from '@storybook/react-vite';
import { IdentitySwitcher } from '..';
import { IdentityRow } from '../../identity-row';

const meta = {
  title: 'Components/IdentitySwitcher',
  component: IdentitySwitcher.Root,
} satisfies Meta<typeof IdentitySwitcher.Root>;

export default meta;

type Story = StoryObj<typeof meta>;

const ROWS = [
  { name: 'Ada Lovelace', initials: 'AL', handle: '@ada', accent: 1 },
  { name: 'Analytical Engines', initials: 'AE', handle: '@engines', accent: 2 },
  { name: 'Notes on the Engine', initials: 'NO', handle: '@notes', accent: 3 },
  { name: 'Byron Reads', initials: 'BR', handle: '@byron', accent: 4 },
  { name: 'Poetry Hour', initials: 'PH', handle: '@poetry', accent: 5 },
  { name: 'The Lab', initials: 'TL', handle: '@lab', accent: 6 },
] as const;

export const Searchable: Story = {
  args: { open: true, onOpenChange: () => undefined, children: null },
  render: (args) => (
    <>
      <p className="m-section text-fg">The page the switcher opens over.</p>
      <IdentitySwitcher.Root {...args}>
        <IdentitySwitcher.Content title="Switch account or channel">
          <IdentitySwitcher.Search placeholder="Find an account or channel" />
          <IdentitySwitcher.List>
            <IdentitySwitcher.Group heading="Accounts and channels">
              {ROWS.map((row, index) => (
                <IdentitySwitcher.Item key={row.handle} value={row.handle}>
                  <IdentityRow.Root current={index === 0}>
                    <IdentityRow.Avatar initials={row.initials} accent={row.accent} />
                    <IdentityRow.Text>
                      <IdentityRow.Name>{row.name}</IdentityRow.Name>
                      <IdentityRow.Detail>{row.handle}</IdentityRow.Detail>
                    </IdentityRow.Text>
                    <IdentityRow.Check />
                  </IdentityRow.Root>
                </IdentitySwitcher.Item>
              ))}
            </IdentitySwitcher.Group>
          </IdentitySwitcher.List>
        </IdentitySwitcher.Content>
      </IdentitySwitcher.Root>
    </>
  ),
};
