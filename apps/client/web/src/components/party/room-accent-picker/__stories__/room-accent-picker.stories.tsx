import type { Meta, StoryObj } from '@storybook/react-vite';
import { withPartyIntl } from '#app/__tests__/with-party-intl';
import { RoomAccentPicker } from '..';

const meta = {
  title: 'Web/RoomAccentPicker',
  decorators: [withPartyIntl],
  component: RoomAccentPicker,
  args: { value: null, onChange: () => undefined },
} satisfies Meta<typeof RoomAccentPicker>;

export default meta;

type Story = StoryObj<typeof meta>;

export const None: Story = {};
export const Swatch: Story = { args: { value: '#30a46c' } };
export const Custom: Story = { args: { value: '#12abef' } };
