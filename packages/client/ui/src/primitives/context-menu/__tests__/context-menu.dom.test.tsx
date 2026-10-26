import { render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { axeViolations } from '@vp/web-testing/dom';
import { ContextMenu } from '..';

let container: HTMLElement;

beforeEach(() => {
  container = document.body.appendChild(document.createElement('div'));
});

afterEach(() => {
  container.remove();
});

const renderVideoArea = async ({
  onCopy = () => undefined,
  portaled = false,
}: {
  onCopy?: () => void;
  portaled?: boolean;
} = {}) => {
  const user = userEvent.setup();
  render(
    <ContextMenu.Root>
      <ContextMenu.Trigger>Video area</ContextMenu.Trigger>
      <ContextMenu.Content container={portaled ? container : undefined}>
        <ContextMenu.Label>Video</ContextMenu.Label>
        <ContextMenu.Group>
          <ContextMenu.Item onSelect={onCopy}>Copy video URL</ContextMenu.Item>
        </ContextMenu.Group>
        <ContextMenu.Separator />
        <ContextMenu.Item tone="danger">Report</ContextMenu.Item>
      </ContextMenu.Content>
    </ContextMenu.Root>
  );
  await user.pointer({ keys: '[MouseRight]', target: screen.getByText('Video area') });
  return user;
};

describe('@vp/ui: ContextMenu', () => {
  it('opens on a right click of its trigger with its items named', async () => {
    await renderVideoArea();

    expect(screen.getByRole('menu')).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Copy video URL' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Report' })).toHaveClass('tw:text-danger-ink');
  });

  it('runs the item picked with the keyboard and closes', async () => {
    const onCopy = vi.fn();
    const user = await renderVideoArea({ onCopy });

    await user.keyboard('{ArrowDown}{Enter}');

    expect(onCopy).toHaveBeenCalledOnce();
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('renders inside the container it is given', async () => {
    await renderVideoArea({ portaled: true });

    expect(container).toContainElement(screen.getByRole('menu'));
  });

  it('passes axe open', async () => {
    await renderVideoArea();

    expect(await axeViolations()).toEqual([]);
  });
});
