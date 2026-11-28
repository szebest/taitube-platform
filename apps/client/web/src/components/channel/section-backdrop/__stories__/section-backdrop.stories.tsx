import type { Meta, StoryObj } from '@storybook/react-vite';
import { SectionBackdrop } from '..';

const PICTURE = `data:image/svg+xml,${encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 9"><rect width="16" height="9" fill="midnightblue"/></svg>'
)}`;

const meta = {
  title: 'Web/Channel/SectionBackdrop',
  component: SectionBackdrop,
  args: {
    image: { w640: PICTURE, w1280: PICTURE },
    children: <h2 className="m-0 text-title-lg">Season two is here</h2>,
  },
} satisfies Meta<typeof SectionBackdrop>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
