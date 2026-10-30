import type { Meta, StoryObj } from '@storybook/react-vite';
import { Button } from '../button';
import { ResponsiveModal } from '.';
import { ResponsiveModalRoot } from './responsive-modal';

const meta = {
  title: 'Primitives/ResponsiveModal',
  component: ResponsiveModalRoot,
  tags: ['motion'],
} satisfies Meta<typeof ResponsiveModalRoot>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Open: Story = {
  render: () => (
    <>
      <p className="tw:m-section tw:text-fg">Lisbon at night, on the watch page behind.</p>
      <ResponsiveModal.Root defaultOpen>
        <ResponsiveModal.Content>
          <ResponsiveModal.Title>Share video</ResponsiveModal.Title>
          <ResponsiveModal.Description>Anyone with the link can watch.</ResponsiveModal.Description>
          <ResponsiveModal.Body>https://taitube.example/watch/lisbon</ResponsiveModal.Body>
          <ResponsiveModal.Footer>
            <ResponsiveModal.Close asChild>
              <Button>Done</Button>
            </ResponsiveModal.Close>
          </ResponsiveModal.Footer>
        </ResponsiveModal.Content>
      </ResponsiveModal.Root>
    </>
  ),
};
