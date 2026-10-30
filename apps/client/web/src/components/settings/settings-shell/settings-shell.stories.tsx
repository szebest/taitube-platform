import type { Meta, StoryObj } from '@storybook/react-vite';

import { SettingsShell } from '.';
import { SettingsShellRoot } from './settings-shell';

const meta = {
  title: 'Web/SettingsShell',
  component: SettingsShellRoot,
} satisfies Meta<typeof SettingsShellRoot>;

export default meta;

type Story = StoryObj<typeof meta>;

const SECTIONS = ['Appearance', 'Accessibility', 'Playback'];

export const NavigationAndPane: Story = {
  render: (args) => (
    <SettingsShell.Root {...args}>
      <SettingsShell.Nav aria-label="Settings sections">
        <SettingsShell.NavList>
          {SECTIONS.map((section, index) => (
            <SettingsShell.NavItem key={section} active={index === 0} href="#">
              {section}
            </SettingsShell.NavItem>
          ))}
        </SettingsShell.NavList>
      </SettingsShell.Nav>
      <SettingsShell.Pane>
        <SettingsShell.Back href="#">Settings</SettingsShell.Back>
        <h1>Appearance</h1>
      </SettingsShell.Pane>
    </SettingsShell.Root>
  ),
};
