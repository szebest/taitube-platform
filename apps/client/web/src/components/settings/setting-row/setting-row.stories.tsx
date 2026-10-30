import type { Meta, StoryObj } from '@storybook/react-vite';
import { Switch } from '@vp/ui';

import { SettingRow } from '.';
import { SettingRowRoot } from './setting-row';

const meta = {
  title: 'Web/SettingRow',
  component: SettingRowRoot,
} satisfies Meta<typeof SettingRowRoot>;

export default meta;

type Story = StoryObj<typeof meta>;

const row = (props: { highlighted?: boolean; status?: string }) => (
  <SettingRow.Root highlighted={props.highlighted}>
    <SettingRow.Text>
      <SettingRow.Label>Autoplay next</SettingRow.Label>
      <SettingRow.Description>Start the next video when this one ends.</SettingRow.Description>
    </SettingRow.Text>
    <SettingRow.Control>
      <Switch aria-label="Autoplay next" />
    </SettingRow.Control>
    {props.status && <SettingRow.Status>{props.status}</SettingRow.Status>}
  </SettingRow.Root>
);

export const Default: Story = { render: () => row({}) };

export const Highlighted: Story = { render: () => row({ highlighted: true }) };

export const NotSaved: Story = { render: () => row({ status: 'Not saved to your account' }) };
