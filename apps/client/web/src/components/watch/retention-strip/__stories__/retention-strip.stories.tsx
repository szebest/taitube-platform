import type { Decorator, Meta, StoryObj } from '@storybook/react-vite';
import { RetentionStrip } from '..';
import { RetentionStripRoot } from '../retention-strip';

const CURVE = [
  1, 0.82, 0.74, 0.7, 0.66, 0.64, 0.58, 0.55, 0.52, 0.5, 0.47, 0.45, 0.43, 0.4, 0.38, 0.36, 0.34,
  0.3, 0.27, 0.25, 0.22,
];

const frame: Decorator = (Story) => (
  <div className="max-w-[28rem] p-section">
    <Story />
  </div>
);

const meta = {
  title: 'Web/RetentionStrip',
  component: RetentionStripRoot,
  args: { values: CURVE, role: 'group', 'aria-label': 'Retention' },
  decorators: [frame],
} satisfies Meta<typeof RetentionStripRoot>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const WithMarkers: Story = {
  render: (args) => (
    <RetentionStrip.Root {...args}>
      <RetentionStrip.Marker percent={10} aria-label="Play from 0:42" />
      <RetentionStrip.Marker percent={50} aria-label="Play from 3:30" />
    </RetentionStrip.Root>
  ),
};

export const Flat: Story = { args: { values: Array.from({ length: 21 }, () => 0.5) } };

export const Rtl: Story = {
  ...WithMarkers,
  decorators: [(Story) => <div dir="rtl">{Story()}</div>],
};
