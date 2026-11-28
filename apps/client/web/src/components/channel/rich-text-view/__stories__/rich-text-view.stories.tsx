import type { Meta, StoryObj } from '@storybook/react-vite';
import { richTextTree } from '@vp/validation';
import { RichTextView } from '..';

const BODY = [
  '## About the show',
  '',
  'Weekly episodes about **small things** done *carefully*. Read the [notes](https://example.com).',
  '',
  '- Mondays: the long one',
  '- Fridays: the short one',
].join('\n');

const meta = {
  title: 'Web/Channel/RichTextView',
  component: RichTextView,
  args: { tree: richTextTree(BODY), images: {} },
} satisfies Meta<typeof RichTextView>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
