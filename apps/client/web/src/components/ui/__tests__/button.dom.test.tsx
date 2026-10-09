import { render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { Plus } from 'lucide-react';

import { axeViolations } from '#app/__tests__/axe';
import { Button, IconButton, buttonVariants } from '../button';
import { variantNames } from '../variant-names';

const VARIANTS = variantNames(buttonVariants.variants.variant);

describe('apps/client/web: Button', () => {
  it.each([
    { kind: 'button', Component: Button, slot: 'button' },
    { kind: 'icon button', Component: IconButton, slot: 'icon-button' },
  ])('renders a $kind of type button, named by its label', ({ Component, slot }) => {
    render(
      <Component aria-label="Add">
        <Plus aria-hidden="true" />
      </Component>
    );

    const button = screen.getByRole('button', { name: 'Add' });
    expect(button).toHaveAttribute('type', 'button');
    expect(button).toHaveAttribute('data-slot', slot);
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

  it.each([
    { kind: 'button', Component: Button },
    { kind: 'icon button', Component: IconButton },
  ])('keeps a loading $kind named, busy and deaf to clicks', async ({ Component }) => {
    const onClick = vi.fn();
    render(
      <Component aria-label="Save" loading onClick={onClick}>
        <Plus aria-hidden="true" />
      </Component>
    );

    const button = screen.getByRole('button', { name: 'Save' });
    await userEvent.click(button);

    expect(button).toHaveAttribute('aria-busy', 'true');
    expect(button).toHaveAttribute('aria-disabled', 'true');
    expect(onClick).not.toHaveBeenCalled();
  });

  it('does not submit its form while loading', async () => {
    const onSubmit = vi.fn((event: SubmitEvent) => event.preventDefault());
    render(
      <form onSubmit={(event) => onSubmit(event.nativeEvent as SubmitEvent)}>
        <Button type="submit" loading>
          Publish
        </Button>
      </form>
    );

    await userEvent.click(screen.getByRole('button', { name: 'Publish' }));

    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('refuses a loading state on a button that styles its child, at compile time', () => {
    render(
      // @ts-expect-error a child it does not render cannot show the spinner
      <Button asChild loading>
        <a href="/upload">Upload</a>
      </Button>
    );

    expect(screen.getByRole('link', { name: 'Upload' })).toBeInTheDocument();
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

  it('passes axe', async () => {
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

    expect(await axeViolations()).toEqual([]);
  });
});
