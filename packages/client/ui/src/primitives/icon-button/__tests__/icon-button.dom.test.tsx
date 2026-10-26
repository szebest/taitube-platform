import { render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { axeViolations } from '@vp/web-testing/dom';
import { Icon } from '../../icon';
import { IconButton, type IconButtonProps } from '../icon-button';

const renderIconButton = (props: Partial<IconButtonProps> = {}) =>
  render(
    <IconButton aria-label="Save to Watch later" {...props}>
      <Icon name="save" />
    </IconButton>
  );

describe('@vp/ui: IconButton', () => {
  it('is a quiet square button named by its label', () => {
    renderIconButton();

    const button = screen.getByRole('button', { name: 'Save to Watch later' });
    expect(button).toHaveAttribute('data-slot', 'icon-button');
    expect(button).toHaveClass('tw:aspect-square', 'tw:bg-transparent');
  });

  it('refuses an icon button without a label at compile time', () => {
    render(
      // @ts-expect-error an icon button shows no text, so it must carry a label
      <IconButton>
        <Icon name="save" />
      </IconButton>
    );

    expect(screen.getByRole('button')).toBeInTheDocument();
  });

  it('toggles through aria-pressed and keeps its name', async () => {
    const onClick = vi.fn();
    renderIconButton({ 'aria-pressed': true, onClick });

    await userEvent.click(
      screen.getByRole('button', { name: 'Save to Watch later', pressed: true })
    );

    expect(onClick).toHaveBeenCalledOnce();
  });

  it('passes axe', async () => {
    renderIconButton({ variant: 'solid', tone: 'accent' });

    expect(await axeViolations()).toEqual([]);
  });
});
