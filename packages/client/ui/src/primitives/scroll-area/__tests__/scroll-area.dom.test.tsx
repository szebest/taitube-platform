import { render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { axeViolations } from '@vp/web-testing/dom';
import { ScrollArea, type ScrollAreaProps } from '../scroll-area';

const renderQueue = (props: ScrollAreaProps = {}) =>
  render(
    <ScrollArea className="tw:h-20" {...props}>
      {['Intro', 'Lisbon at night', 'Porto by day'].map((title) => (
        <p key={title}>{title}</p>
      ))}
    </ScrollArea>
  );

describe('@vp/ui: ScrollArea', () => {
  it('puts the focus stop and the name on the scrolling viewport, so a keyboard can scroll it', async () => {
    renderQueue({ tabIndex: 0, 'aria-label': 'Up next' });

    await userEvent.tab();

    const region = screen.getByRole('region', { name: 'Up next' });
    expect(region).toHaveAttribute('data-slot', 'scroll-area-viewport');
    expect(region).toHaveFocus();
  });

  it('fades its clipped edges only when asked', () => {
    const { container } = renderQueue({ fade: true });

    expect(container.querySelector('[data-slot="scroll-area-viewport"]')).toHaveClass(
      'tw:scroll-fade'
    );
  });

  it('passes axe', async () => {
    renderQueue({ tabIndex: 0, 'aria-label': 'Up next', size: 'sm' });

    expect(await axeViolations()).toEqual([]);
  });
});
