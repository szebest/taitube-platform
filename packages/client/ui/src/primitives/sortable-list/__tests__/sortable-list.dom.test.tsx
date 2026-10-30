import { render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { axeViolations } from '@vp/web-testing/dom';
import { SortableList } from '..';
import { WithUiCopy } from '../../../__tests__/ui-copy-fixture';
import type { SortableListRootProps } from '../sortable-list';

const VIDEOS = ['Lisbon at night', 'Harbour at dawn', 'Tram 28'];

const renderQueue = (props: Partial<SortableListRootProps> = {}) => {
  const user = userEvent.setup();
  const onReorder = vi.fn();
  return {
    user,
    onReorder,
    ...render(
      <SortableList.Root items={VIDEOS} onReorder={onReorder} aria-label="Queue" {...props}>
        {VIDEOS.map((title) => (
          <SortableList.Item key={title} id={title} aria-label={title}>
            <SortableList.Handle />
            {title}
          </SortableList.Item>
        ))}
      </SortableList.Root>,
      { wrapper: WithUiCopy }
    ),
  };
};

const ROW_HEIGHT = 40;

describe('@vp/ui: SortableList', () => {
  beforeEach(() => {
    vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (
      this: Element
    ) {
      const row = this.closest('li');
      const top = row ? [...(row.parentElement?.children ?? [])].indexOf(row) * ROW_HEIGHT : 0;
      return new DOMRect(0, top, 300, row ? ROW_HEIGHT : 0);
    });
  });

  it('gives each row a handle named after it', () => {
    renderQueue();

    expect(screen.getByRole('button', { name: 'Reorder Harbour at dawn' })).toBeInTheDocument();
  });

  it('moves a row with the keyboard, announces each step and calls onReorder once on drop', async () => {
    const { user, onReorder } = renderQueue();

    await user.tab();
    await user.keyboard('[Space]');
    expect(
      await screen.findByText('Picked up Lisbon at night, position 1 of 3')
    ).toBeInTheDocument();
    await user.keyboard('{ArrowDown}');
    expect(await screen.findByText('Moved to position 2')).toBeInTheDocument();
    expect(onReorder).not.toHaveBeenCalled();
    await user.keyboard('[Space]');

    expect(onReorder).toHaveBeenCalledOnce();
    expect(onReorder).toHaveBeenCalledWith(['Harbour at dawn', 'Lisbon at night', 'Tram 28']);
  });

  it('puts the row back and calls nothing on Escape', async () => {
    const { user, onReorder } = renderQueue();

    await user.tab();
    await user.keyboard('[Space]{ArrowDown}{Escape}');

    expect(onReorder).not.toHaveBeenCalled();
    expect(await screen.findByText('Cancelled')).toBeInTheDocument();
  });

  it('hides its handles when the list is disabled', () => {
    renderQueue({ 'aria-disabled': true });

    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('passes axe', async () => {
    renderQueue();

    expect(await axeViolations()).toEqual([]);
  });
});
