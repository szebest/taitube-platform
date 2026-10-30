import { render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { axeViolations } from '@vp/web-testing/dom';
import { WithUiCopy } from '../../../__tests__/ui-copy-fixture';
import { Button } from '../../button';
import { Drawer } from '..';
import type { DrawerSize } from '../types';

const renderQueueDrawer = (size?: DrawerSize) => {
  const user = userEvent.setup();
  return {
    user,
    ...render(
      <Drawer.Root>
        <Drawer.Trigger asChild>
          <Button>Queue</Button>
        </Drawer.Trigger>
        <Drawer.Content size={size}>
          <Drawer.Handle />
          <Drawer.Title>Your queue</Drawer.Title>
          <Drawer.Description>Up next</Drawer.Description>
          <Drawer.Body>Lisbon at night</Drawer.Body>
          <Drawer.Footer>
            <Drawer.Close asChild>
              <Button>Done</Button>
            </Drawer.Close>
          </Drawer.Footer>
        </Drawer.Content>
      </Drawer.Root>,
      { wrapper: WithUiCopy }
    ),
  };
};

describe('@vp/ui: Drawer', () => {
  beforeEach(() => {
    Element.prototype.setPointerCapture = () => undefined;
  });

  it.each([
    { size: 'sm', height: 'tw:max-h-[40dvh]' },
    { size: 'md', height: 'tw:max-h-[70dvh]' },
    { size: 'lg', height: 'tw:max-h-[92dvh]' },
  ] as const)(
    'rises from the bottom edge at size $size as a dialog named by its title',
    async ({ size, height }) => {
      const { user } = renderQueueDrawer(size);

      await user.click(screen.getByRole('button', { name: 'Queue' }));

      const drawer = screen.getByRole('dialog', { name: 'Your queue' });
      expect(drawer).toHaveClass('tw:bottom-0', height);
      expect(drawer).toHaveAccessibleDescription('Up next');
    }
  );

  it.each([
    { how: 'its handle', close: () => screen.getByRole('button', { name: 'Close' }) },
    { how: 'a close action', close: () => screen.getByRole('button', { name: 'Done' }) },
  ])('closes from $how and hands focus back to the trigger', async ({ close }) => {
    const { user } = renderQueueDrawer();
    await user.click(screen.getByRole('button', { name: 'Queue' }));

    await user.click(close());

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Queue' })).toHaveFocus();
  });

  it('closes on Escape', async () => {
    const { user } = renderQueueDrawer();
    await user.click(screen.getByRole('button', { name: 'Queue' }));

    await user.keyboard('{Escape}');

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('passes axe open', async () => {
    const { user } = renderQueueDrawer();
    await user.click(screen.getByRole('button', { name: 'Queue' }));

    expect(await axeViolations()).toEqual([]);
  });
});
