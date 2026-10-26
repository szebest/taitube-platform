import type { Meta, StoryObj } from '@storybook/react-vite';
import { Button } from '../button';
import { AlertDialog } from '.';
import { AlertDialogContent } from './alert-dialog';

const meta = {
  title: 'Primitives/AlertDialog',
  component: AlertDialogContent,
} satisfies Meta<typeof AlertDialogContent>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Destructive: Story = {
  render: () => (
    <>
      <p className="tw:m-section tw:text-fg">Lisbon at night, on the watch page behind.</p>
      <AlertDialog.Root defaultOpen>
        <AlertDialog.Content size="sm">
          <AlertDialog.Title>Delete this video?</AlertDialog.Title>
          <AlertDialog.Description>
            Lisbon at night leaves every playlist and cannot be restored.
          </AlertDialog.Description>
          <AlertDialog.Footer>
            <AlertDialog.Cancel asChild>
              <Button>Keep</Button>
            </AlertDialog.Cancel>
            <AlertDialog.Action asChild>
              <Button variant="solid" tone="danger">
                Delete video
              </Button>
            </AlertDialog.Action>
          </AlertDialog.Footer>
        </AlertDialog.Content>
      </AlertDialog.Root>
    </>
  ),
};
