import { render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { axeViolations } from '@vp/web-testing/dom';

import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuGroup,
  ContextMenuItem,
  ContextMenuLabel,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from '../context-menu';

let container: HTMLElement;

beforeEach(() => {
  container = document.body.appendChild(document.createElement('div'));
});

afterEach(() => {
  container.remove();
});

function renderContextMenu({
  onCopy = () => undefined,
  portaled = false,
}: {
  onCopy?: () => void;
  portaled?: boolean;
} = {}) {
  return render(
    <ContextMenu>
      <ContextMenuTrigger>Video area</ContextMenuTrigger>
      <ContextMenuContent container={portaled ? container : undefined}>
        <ContextMenuLabel>Video</ContextMenuLabel>
        <ContextMenuGroup>
          <ContextMenuItem onSelect={onCopy}>Copy video URL</ContextMenuItem>
        </ContextMenuGroup>
        <ContextMenuSeparator />
        <ContextMenuItem variant="destructive">Report</ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}

async function openWithRightClick() {
  await userEvent.pointer({
    keys: '[MouseRight]',
    target: screen.getByText('Video area'),
  });
}

describe('@vp/ui: ContextMenu', () => {
  it('opens on a right click of its trigger with its items named', async () => {
    renderContextMenu();

    await openWithRightClick();

    expect(screen.getByRole('menu')).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Copy video URL' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Report' })).toBeInTheDocument();
  });

  it('runs the item picked with the keyboard and closes', async () => {
    const onCopy = vi.fn();
    renderContextMenu({ onCopy });
    await openWithRightClick();

    await userEvent.keyboard('{ArrowDown}{Enter}');

    expect(onCopy).toHaveBeenCalledOnce();
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('renders inside the container it is given', async () => {
    renderContextMenu({ portaled: true });

    await openWithRightClick();

    expect(container).toContainElement(screen.getByRole('menu'));
  });

  it('passes axe open', async () => {
    renderContextMenu();
    await openWithRightClick();

    expect(await axeViolations()).toEqual([]);
  });
});
