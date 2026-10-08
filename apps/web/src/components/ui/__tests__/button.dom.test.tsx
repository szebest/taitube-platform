import { render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { Plus } from 'lucide-react';

import { THEMES, axeViolations } from '#app/__tests__/axe';
import { Button, IconButton, buttonVariants } from '../button';
import { variantNames } from '../variant-names';

const VARIANTS = variantNames(buttonVariants.variants.variant);
const SIZES = variantNames(buttonVariants.variants.size);
const EVERY_LOOK = VARIANTS.flatMap((variant) => SIZES.map((size) => ({ variant, size })));

describe('apps/web: Button', () => {
  it.each(EVERY_LOOK)('renders a $variant $size button named by its text', ({ variant, size }) => {
    render(
      <Button variant={variant} size={size}>
        Save
      </Button>
    );

    const button = screen.getByRole('button', { name: 'Save' });
    expect(button).toHaveAttribute('type', 'button');
    expect(button).toHaveAttribute('data-slot', 'button');
  });

  it.each(EVERY_LOOK)('names a $variant $size icon button by its label', ({ variant, size }) => {
    render(
      <IconButton variant={variant} size={size} aria-label="Add">
        <Plus aria-hidden="true" />
      </IconButton>
    );

    expect(screen.getByRole('button', { name: 'Add' })).toHaveAttribute('data-slot', 'icon-button');
  });

  it('refuses an icon button without a label at compile time', () => {
    // @ts-expect-error an icon button shows no text, so it must carry a label
    render(<IconButton />);

    expect(screen.getByRole('button')).toBeInTheDocument();
  });

  it('is reached with Tab and pressed with Enter and Space, with the shared focus ring', async () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Save</Button>);

    await userEvent.tab();
    await userEvent.keyboard('{Enter}[Space]');

    const button = screen.getByRole('button', { name: 'Save' });
    expect(button).toHaveFocus();
    expect(button).toHaveClass('tw:focus-ring');
    expect(onClick).toHaveBeenCalledTimes(2);
  });

  it('ignores a click while disabled', async () => {
    const onClick = vi.fn();
    render(
      <Button disabled onClick={onClick}>
        Save
      </Button>
    );

    await userEvent.click(screen.getByRole('button', { name: 'Save' }));

    expect(onClick).not.toHaveBeenCalled();
  });

  it('styles the element it is given, a link for one, without a button type', () => {
    render(
      <Button asChild variant="primary">
        <a href="/upload">Upload</a>
      </Button>
    );

    const link = screen.getByRole('link', { name: 'Upload' });
    expect(link).toHaveClass('tw:bg-accent');
    expect(link).not.toHaveAttribute('type');
  });

  it('lets a caller override a class without leaving the conflicting one behind', () => {
    render(<Button className="tw:px-8">Save</Button>);

    const { className } = screen.getByRole('button', { name: 'Save' });
    expect(className).toContain('tw:px-8');
    expect(className).not.toContain('tw:px-4');
  });

  it.each(THEMES)('passes axe in the %s theme', async (theme) => {
    render(
      <>
        {VARIANTS.map((variant) => (
          <Button key={variant} variant={variant}>
            {variant}
          </Button>
        ))}
        <IconButton aria-label="Add">
          <Plus aria-hidden="true" />
        </IconButton>
        <Button disabled>Disabled</Button>
      </>
    );

    expect(await axeViolations(theme)).toEqual([]);
  });
});
