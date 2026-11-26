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
  { name: 'Ada Lovelace', handle: '@ada', accent: 1 },
  { name: 'Analytical Engines', handle: '@engines', accent: 2 },
  { name: 'Notes on the Engine', handle: '@notes', accent: 3 },
  { name: 'Byron Reads', handle: '@byron', accent: 4 },
  { name: 'Poetry Hour', handle: '@poetry', accent: 5 },
  { name: 'The Lab', handle: '@lab', accent: 6 },
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
                    <IdentityRow.Avatar name={row.name} accent={row.accent} />
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
