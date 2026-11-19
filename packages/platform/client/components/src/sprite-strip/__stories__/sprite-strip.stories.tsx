import type { Meta, StoryObj } from '@storybook/react-vite';
import { SpriteStrip } from '../sprite-strip';

const sprite = {
  url: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="90"><rect width="1600" height="90" fill="%23778"/></svg>',
  intervalSec: 10,
  columns: 10,
  tileWidth: 160,
  tileHeight: 90,
};

const meta = {
  title: 'Components/SpriteStrip',
  component: SpriteStrip,
  args: { sprite, durationMs: 100_000, className: 'w-full max-w-prose' },
} satisfies Meta<typeof SpriteStrip>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Frames: Story = {};

export const WithShade: Story = {
  args: { shade: { startMs: 20_000, endMs: 60_000 } },
};

export const Few: Story = {
  args: { frames: 4 },
};
