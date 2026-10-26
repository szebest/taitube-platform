import type { Meta, StoryObj } from '@storybook/react-vite';
import { Button } from '../button';
import { Drawer } from '.';
import { DrawerContent } from './drawer';

const meta = {
  title: 'Primitives/Drawer',
  component: DrawerContent,
} satisfies Meta<typeof DrawerContent>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Sizes: Story = {
  args: { size: 'md' },
  render: (args) => (
    <>
      <p className="tw:m-section tw:text-fg">Lisbon at night, on the watch page behind.</p>
      <Drawer.Root defaultOpen>
        <Drawer.Content {...args}>
          <Drawer.Handle />
          <Drawer.Title>Your queue</Drawer.Title>
          <Drawer.Description>Up next, in order.</Drawer.Description>
          <Drawer.Body>
            {['Lisbon at night', 'Harbour at dawn', 'Tram 28, end to end'].map((title) => (
              <p key={title}>{title}</p>
            ))}
          </Drawer.Body>
          <Drawer.Footer>
            <Drawer.Close asChild>
              <Button>Done</Button>
            </Drawer.Close>
          </Drawer.Footer>
        </Drawer.Content>
      </Drawer.Root>
    </>
  ),
};

export const Small: Story = { ...Sizes, args: { size: 'sm' } };

export const Large: Story = { ...Sizes, args: { size: 'lg' } };
