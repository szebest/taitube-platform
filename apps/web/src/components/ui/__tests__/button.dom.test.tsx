import { render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';

import { THEMES, axeViolations } from '#app/__tests__/axe';
import { Button } from '../button';

describe('apps/web: Button', () => {
  it.each(['primary', 'secondary', 'ghost', 'destructive'] as const)(
    'renders a %s button named by its text',
    (variant) => {
      render(<Button variant={variant}>Save</Button>);

      expect(screen.getByRole('button', { name: 'Save' })).toHaveAttribute('type', 'button');
    }
  );

  it('names an icon button by its label', () => {
    render(
      <Button size="icon" aria-label="Close">
        <svg aria-hidden="true" />
      </Button>
    );

    expect(screen.getByRole('button', { name: 'Close' })).toBeInTheDocument();
  });

  it('refuses an icon button without a label at compile time', () => {
    // @ts-expect-error an icon button has no text, so it must carry a label
    render(<Button size="icon" />);

    expect(screen.getByRole('button')).toBeInTheDocument();
  });

  it('is reached with Tab and pressed with Enter and Space', async () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Save</Button>);

    await userEvent.tab();
    await userEvent.keyboard('{Enter}[Space]');

    expect(screen.getByRole('button', { name: 'Save' })).toHaveFocus();
    expect(screen.getByRole('button', { name: 'Save' })).toHaveClass('tw:focus-ring');
    expect(onClick).toHaveBeenCalledTimes(2);
  });

  it('styles the element it is given, such as a link', () => {
    render(
      <Button asChild variant="primary">
        <a href="/upload">Upload</a>
      </Button>
    );

    const link = screen.getByRole('link', { name: 'Upload' });
    expect(link).toHaveClass('tw:bg-accent');
    expect(link).not.toHaveAttribute('type');
  });

  it('lets a caller override a class without a conflict', () => {
    render(<Button className="tw:px-8">Save</Button>);

    expect(screen.getByRole('button', { name: 'Save' }).className).not.toContain('tw:px-4');
  });

  it.each(THEMES)('passes axe in the %s theme', async (theme) => {
    render(
      <>
        <Button variant="primary">Save</Button>
        <Button size="icon" variant="ghost" aria-label="Close">
          <svg aria-hidden="true" />
        </Button>
        <Button disabled>Disabled</Button>
      </>
    );

    expect(await axeViolations(theme)).toEqual([]);
  });
});
