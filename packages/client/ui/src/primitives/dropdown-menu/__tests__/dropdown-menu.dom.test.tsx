import { render, screen, within } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { axeViolations } from '@vp/web-testing/dom';
import { useState } from 'react';
import { Icon } from '../../icon';
import { IconButton } from '../../icon-button';
import { Kbd } from '../../kbd';
import { DropdownMenu } from '..';
import type { MenuSize } from '../types';

let container: HTMLElement;

beforeEach(() => {
  container = document.body.appendChild(document.createElement('div'));
});

afterEach(() => {
  container.remove();
});

interface VideoMenuProps {
  onShare?: () => void;
  onDelete?: () => void;
  portaled?: boolean;
  size?: MenuSize;
}

const VideoMenu = ({
  onShare = () => undefined,
  onDelete = () => undefined,
  portaled = false,
  size,
}: VideoMenuProps) => {
  const portal = portaled ? container : undefined;
  const [quality, setQuality] = useState('auto');
  const [captions, setCaptions] = useState(false);

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <IconButton aria-label="More actions">
          <Icon name="more" />
        </IconButton>
      </DropdownMenu.Trigger>
      <DropdownMenu.Content container={portal} size={size}>
        <DropdownMenu.Group>
          <DropdownMenu.Item onSelect={onShare}>
            Share
            <DropdownMenu.Shortcut>
              <Kbd>S</Kbd>
            </DropdownMenu.Shortcut>
          </DropdownMenu.Item>
          <DropdownMenu.CheckboxItem checked={captions} onCheckedChange={setCaptions}>
            Captions
          </DropdownMenu.CheckboxItem>
        </DropdownMenu.Group>
        <DropdownMenu.Sub>
          <DropdownMenu.SubTrigger>Quality</DropdownMenu.SubTrigger>
          <DropdownMenu.SubContent container={portal}>
            <DropdownMenu.Label>Quality</DropdownMenu.Label>
            <DropdownMenu.RadioGroup value={quality} onValueChange={setQuality}>
              <DropdownMenu.RadioItem value="auto">Auto</DropdownMenu.RadioItem>
              <DropdownMenu.RadioItem value="1080p">1080p</DropdownMenu.RadioItem>
            </DropdownMenu.RadioGroup>
          </DropdownMenu.SubContent>
        </DropdownMenu.Sub>
        <DropdownMenu.Separator />
        <DropdownMenu.Item tone="danger" onSelect={onDelete}>
          Delete
        </DropdownMenu.Item>
      </DropdownMenu.Content>
    </DropdownMenu.Root>
  );
};

const renderVideoMenu = async (props: VideoMenuProps = {}) => {
  const user = userEvent.setup();
  render(<VideoMenu {...props} />);
  await user.tab();
  await user.keyboard('{Enter}');
  return user;
};

describe('@vp/ui: DropdownMenu', () => {
  it('opens from its named trigger with the first item focused', async () => {
    await renderVideoMenu();

    expect(screen.getByRole('button', { name: 'More actions', hidden: true })).toHaveAttribute(
      'aria-expanded',
      'true'
    );
    expect(screen.getByRole('menuitem', { name: /^Share/ })).toHaveFocus();
  });

  it.each([
    { item: 'Share', keys: '{Enter}', handler: 'onShare' },
    { item: 'Delete', keys: '{End}{Enter}', handler: 'onDelete' },
  ] as const)(
    'runs $item when picked with the keyboard and hands focus back',
    async ({ keys, handler }) => {
      const handlers = { onShare: vi.fn(), onDelete: vi.fn() };
      const user = await renderVideoMenu(handlers);

      await user.keyboard(keys);

      expect(handlers[handler]).toHaveBeenCalledOnce();
      expect(screen.queryByRole('menu')).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'More actions' })).toHaveFocus();
    }
  );

  it('toggles a checkbox item with Space', async () => {
    const user = await renderVideoMenu();

    await user.keyboard('{ArrowDown}[Space]');

    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    await user.keyboard('{Enter}{ArrowDown}');
    expect(screen.getByRole('menuitemcheckbox', { name: 'Captions' })).toBeChecked();
  });

  it('opens a sub-menu with ArrowRight and checks the radio item picked', async () => {
    const user = await renderVideoMenu();

    await user.keyboard('{ArrowDown}{ArrowDown}{ArrowRight}{ArrowDown}');
    expect(screen.getByRole('menuitemradio', { name: '1080p' })).toHaveFocus();
    await user.keyboard('{Enter}{Enter}{ArrowDown}{ArrowDown}{ArrowRight}');

    expect(screen.getByRole('menuitemradio', { name: '1080p' })).toBeChecked();
    expect(screen.getByRole('menuitemradio', { name: 'Auto' })).not.toBeChecked();
  });

  it.each([
    { size: 'sm', row: 'tw:h-control-sm' },
    { size: 'md', row: 'tw:h-control-md' },
  ] as const)('sizes its rows by $size, the danger one in danger ink', async ({ size, row }) => {
    await renderVideoMenu({ size });

    expect(screen.getByRole('menuitem', { name: /^Share/ })).toHaveClass(row);
    expect(screen.getByRole('menuitem', { name: 'Delete' })).toHaveClass('tw:text-danger-ink');
  });

  it('renders the menu and its sub-menu inside the container it is given', async () => {
    const user = await renderVideoMenu({ portaled: true });

    await user.keyboard('{ArrowDown}{ArrowDown}{ArrowRight}');

    expect(within(container).getAllByRole('menu')).toHaveLength(2);
  });

  it('passes axe open', async () => {
    await renderVideoMenu();

    expect(await axeViolations()).toEqual([]);
  });
});
