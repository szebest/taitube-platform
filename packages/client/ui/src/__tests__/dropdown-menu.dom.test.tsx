import { render, screen, within } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { axeViolations } from '@vp/web-testing/dom';
import { EllipsisVertical } from 'lucide-react';
import { useState } from 'react';

import { IconButton } from '../primitives/icon-button';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '../dropdown-menu';

let container: HTMLElement;

beforeEach(() => {
  container = document.body.appendChild(document.createElement('div'));
});

afterEach(() => {
  container.remove();
});

function VideoMenu({
  onShare = () => undefined,
  onDelete = () => undefined,
  portaled = false,
}: {
  onShare?: () => void;
  onDelete?: () => void;
  portaled?: boolean;
}) {
  const portal = portaled ? container : undefined;
  const [quality, setQuality] = useState('auto');
  const [captions, setCaptions] = useState(false);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <IconButton aria-label="More actions">
          <EllipsisVertical aria-hidden="true" />
        </IconButton>
      </DropdownMenuTrigger>
      <DropdownMenuContent container={portal}>
        <DropdownMenuGroup>
          <DropdownMenuItem onSelect={onShare}>
            Share
            <DropdownMenuShortcut>S</DropdownMenuShortcut>
          </DropdownMenuItem>
          <DropdownMenuCheckboxItem checked={captions} onCheckedChange={setCaptions}>
            Captions
          </DropdownMenuCheckboxItem>
        </DropdownMenuGroup>
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>Quality</DropdownMenuSubTrigger>
          <DropdownMenuSubContent container={portal}>
            <DropdownMenuLabel>Quality</DropdownMenuLabel>
            <DropdownMenuRadioGroup value={quality} onValueChange={setQuality}>
              <DropdownMenuRadioItem value="auto">Auto</DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="1080p">1080p</DropdownMenuRadioItem>
            </DropdownMenuRadioGroup>
          </DropdownMenuSubContent>
        </DropdownMenuSub>
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" onSelect={onDelete}>
          Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

const renderVideoMenu = (props: Parameters<typeof VideoMenu>[0] = {}) =>
  render(<VideoMenu {...props} />);

async function openFromKeyboard() {
  await userEvent.tab();
  await userEvent.keyboard('{Enter}');
}

describe('@vp/ui: DropdownMenu', () => {
  it('opens from its named trigger with the first item focused', async () => {
    renderVideoMenu();
    const trigger = screen.getByRole('button', { name: 'More actions' });

    await openFromKeyboard();

    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('menuitem', { name: /^Share/ })).toHaveFocus();
  });

  it.each([
    { item: 'Share', keys: '{Enter}', handler: 'onShare' },
    { item: 'Delete', keys: '{End}{Enter}', handler: 'onDelete' },
  ] as const)(
    'runs $item when picked with the keyboard and hands focus back',
    async ({ keys, handler }) => {
      const handlers = { onShare: vi.fn(), onDelete: vi.fn() };
      renderVideoMenu(handlers);
      await openFromKeyboard();

      await userEvent.keyboard(keys);

      expect(handlers[handler]).toHaveBeenCalledOnce();
      expect(screen.queryByRole('menu')).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'More actions' })).toHaveFocus();
    }
  );

  it('toggles a checkbox item with Space', async () => {
    renderVideoMenu();
    await openFromKeyboard();

    await userEvent.keyboard('{ArrowDown}[Space]');
    await userEvent.keyboard('{Enter}');

    expect(screen.getByRole('menuitemcheckbox', { name: 'Captions' })).toBeChecked();
  });

  it('opens a sub-menu with ArrowRight and checks the radio item picked', async () => {
    renderVideoMenu();
    await openFromKeyboard();

    await userEvent.keyboard('{ArrowDown}{ArrowDown}{ArrowRight}');
    await userEvent.keyboard('{ArrowDown}');
    expect(screen.getByRole('menuitemradio', { name: '1080p' })).toHaveFocus();
    await userEvent.keyboard('{Enter}');
    await userEvent.keyboard('{Enter}{ArrowDown}{ArrowDown}{ArrowRight}');

    expect(screen.getByRole('menuitemradio', { name: '1080p' })).toBeChecked();
    expect(screen.getByRole('menuitemradio', { name: 'Auto' })).not.toBeChecked();
  });

  it('renders the menu and its sub-menu inside the container it is given', async () => {
    renderVideoMenu({ portaled: true });
    await openFromKeyboard();

    await userEvent.keyboard('{ArrowDown}{ArrowDown}{ArrowRight}');

    expect(within(container).getAllByRole('menu')).toHaveLength(2);
    expect(screen.getAllByRole('menu')).toHaveLength(2);
  });

  it('passes axe open', async () => {
    renderVideoMenu();
    await openFromKeyboard();

    expect(await axeViolations()).toEqual([]);
  });
});
