import type { Meta, StoryObj } from '@storybook/react-vite';

import { SettingsSection } from '.';
import { SettingsSectionRoot } from './settings-section';

const meta = {
  title: 'Web/SettingsSection',
  component: SettingsSectionRoot,
} satisfies Meta<typeof SettingsSectionRoot>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: (args) => (
    <SettingsSection.Root {...args}>
      <SettingsSection.Title>Playback</SettingsSection.Title>
      <SettingsSection.Description>What a video starts with.</SettingsSection.Description>
      <SettingsSection.Body>
        <p className="tw:m-0 tw:p-inset-card">Rows go here.</p>
      </SettingsSection.Body>
    </SettingsSection.Root>
  ),
};
