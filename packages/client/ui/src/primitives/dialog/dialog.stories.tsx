import type { Meta, StoryObj } from '@storybook/react-vite';
import { Button } from '../button';
import { Input } from '../input';
import { Dialog } from '.';
import { DialogContent } from './dialog';

const meta = {
  title: 'Primitives/Dialog',
  component: DialogContent,
  tags: ['motion'],
} satisfies Meta<typeof DialogContent>;

export default meta;

type Story = StoryObj<typeof meta>;

const RenameVideo = (props: {
  side?: 'inline-start' | 'inline-end';
  size?: 'sm' | 'md' | 'lg';
}) => (
  <>
    <p className="tw:m-section tw:text-fg">Lisbon at night, on the watch page behind.</p>
    <Dialog.Root defaultOpen>
      <Dialog.Content {...props}>
        <Dialog.Header>
          <Dialog.Title>Rename video</Dialog.Title>
          <Dialog.Description>Shown on the watch page.</Dialog.Description>
        </Dialog.Header>
        <Dialog.Body>
          <Input
            aria-label="Title"
            defaultValue="Shot entirely on a 1998 camcorder: Lisbon at night"
          />
        </Dialog.Body>
        <Dialog.Footer>
          <Dialog.Close asChild>
            <Button>Cancel</Button>
          </Dialog.Close>
          <Button variant="solid" tone="accent">
            Save
          </Button>
        </Dialog.Footer>
      </Dialog.Content>
    </Dialog.Root>
  </>
);

export const Centred: Story = { render: () => <RenameVideo /> };

export const Small: Story = { render: () => <RenameVideo size="sm" /> };

export const SheetAtStart: Story = { render: () => <RenameVideo side="inline-start" /> };

export const SheetAtEnd: Story = { render: () => <RenameVideo side="inline-end" size="sm" /> };
