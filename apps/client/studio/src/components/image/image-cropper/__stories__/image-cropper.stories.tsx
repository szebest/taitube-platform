import type { Meta, StoryObj } from '@storybook/react-vite';
import { ImageCropper, type ImageCropperRootProps } from '../index';

const SIZE = { width: 2560, height: 1440 };

const SRC = `data:image/svg+xml;utf8,${encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" width="2560" height="1440"><defs><linearGradient id="g"><stop offset="0" stop-color="#456"/><stop offset="1" stop-color="#c84"/></linearGradient></defs><rect width="2560" height="1440" fill="url(#g)"/><circle cx="1280" cy="720" r="300" fill="#fff" fill-opacity="0.6"/></svg>'
)}`;

type CropperArgs = Pick<ImageCropperRootProps, 'kind' | 'status'>;

const meta = {
  title: 'Studio/ImageCropper',
  component: ImageCropper.Root,
  args: {
    kind: 'banner',
    src: SRC,
    size: SIZE,
    open: true,
    onOpenChange: () => {},
    onConfirm: () => {},
  },
  render: (args: CropperArgs & ImageCropperRootProps) => (
    <ImageCropper.Root {...args}>
      <ImageCropper.Title>Frame your image</ImageCropper.Title>
      <ImageCropper.Description>
        Drag the frame, or use the arrow keys, and zoom to choose what shows.
      </ImageCropper.Description>
      <ImageCropper.Targets
        aria-label="Screen"
        labels={{ desktop: 'Desktop', mobile: 'Mobile', tv: 'TV' }}
      />
      <ImageCropper.Stage label="Crop area" />
      <ImageCropper.Zoom label="Zoom" />
      <ImageCropper.Previews
        labels={{ avatar: 'Picture', desktop: 'Desktop', mobile: 'Mobile', tv: 'TV' }}
      />
      <ImageCropper.Status label="Processing your image" />
      <ImageCropper.Cancel>Cancel</ImageCropper.Cancel>
      <ImageCropper.Confirm>Use image</ImageCropper.Confirm>
    </ImageCropper.Root>
  ),
} satisfies Meta<typeof ImageCropper.Root>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Banner: Story = {};

export const Avatar: Story = { args: { kind: 'avatar' } };

export const Queued: Story = { args: { status: 'queued' } };

export const Ready: Story = { args: { status: 'ready' } };

export const Failed: Story = { args: { status: 'failed' } };

export const TallImage: Story = { args: { size: { width: 1200, height: 3000 } } };
