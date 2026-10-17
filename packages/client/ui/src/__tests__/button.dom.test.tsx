import { render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { axeViolations } from '@vp/web-testing/dom';
import { Plus } from 'lucide-react';

import {
  Button,
  type ButtonProps,
  buttonVariants,
  IconButton,
  type IconButtonProps,
} from '../button';
import { variantNames } from '../variant-names';

const VARIANTS = variantNames(buttonVariants.variants.variant);

const defaultButtonProps = { children: 'Save' };

function renderButton(props: ButtonProps = {}) {
  const user = userEvent.setup();
  return { user, ...render(<Button {...defaultButtonProps} {...props} />) };
}

function renderIconButton(props: IconButtonProps) {
  const user = userEvent.setup();
  return { user, ...render(<IconButton {...props} />) };
}

function renderPublishForm(onSubmit: (event: SubmitEvent) => void) {
  const user = userEvent.setup();
  return {
    user,
    ...render(
      <form onSubmit={(event) => onSubmit(event.nativeEvent as SubmitEvent)}>
        <Button type="submit" loading>
          Publish
        </Button>
      </form>
    ),
  };
}

function renderEveryButton() {
  return render(
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
}

const icon = <Plus aria-hidden="true" />;

describe('@vp/ui: Button', () => {
  it.each([
    { kind: 'button', renderKind: renderButton, slot: 'button' },
    { kind: 'icon button', renderKind: renderIconButton, slot: 'icon-button' },
  ])('renders a $kind of type button, named by its label', ({ renderKind, slot }) => {
    renderKind({ 'aria-label': 'Add', children: icon });

    const button = screen.getByRole('button', { name: 'Add' });
    expect(button).toHaveAttribute('type', 'button');
    expect(button).toHaveAttribute('data-slot', slot);
  });

  it('refuses an icon button without a label at compile time', () => {
    // @ts-expect-error an icon button shows no text, so it must carry a label
    renderIconButton({});

    expect(screen.getByRole('button')).toBeInTheDocument();
  });

  it('is reached with Tab and pressed with Enter and Space, with the shared focus ring', async () => {
    const onClick = vi.fn();
    const { user } = renderButton({ onClick });

    await user.tab();
    await user.keyboard('{Enter}[Space]');

    const button = screen.getByRole('button', { name: 'Save' });
    expect(button).toHaveFocus();
    expect(button).toHaveClass('tw:focus-ring');
    expect(onClick).toHaveBeenCalledTimes(2);
  });

  it('ignores a click while disabled', async () => {
    const onClick = vi.fn();
    const { user } = renderButton({ disabled: true, onClick });

    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(onClick).not.toHaveBeenCalled();
  });

  it.each([
    { kind: 'button', renderKind: renderButton },
    { kind: 'icon button', renderKind: renderIconButton },
  ])('keeps a loading $kind named, busy and deaf to clicks', async ({ renderKind }) => {
    const onClick = vi.fn();
    const { user } = renderKind({ 'aria-label': 'Save', loading: true, onClick, children: icon });

    const button = screen.getByRole('button', { name: 'Save' });
    await user.click(button);

    expect(button).toHaveAttribute('aria-busy', 'true');
    expect(button).toHaveAttribute('aria-disabled', 'true');
    expect(onClick).not.toHaveBeenCalled();
  });

  it('does not submit its form while loading', async () => {
    const onSubmit = vi.fn((event: SubmitEvent) => event.preventDefault());
    const { user } = renderPublishForm(onSubmit);

    await user.click(screen.getByRole('button', { name: 'Publish' }));

    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('refuses a loading state on a button that styles its child, at compile time', () => {
    renderButton({
      asChild: true,
      // @ts-expect-error a child it does not render cannot show the spinner
      loading: true,
      children: <a href="/upload">Upload</a>,
    });

    expect(screen.getByRole('link', { name: 'Upload' })).toBeInTheDocument();
  });

  it('styles the element it is given, a link for one, without a button type', () => {
    renderButton({ asChild: true, variant: 'primary', children: <a href="/upload">Upload</a> });

    const link = screen.getByRole('link', { name: 'Upload' });
    expect(link).toHaveClass('tw:bg-accent');
    expect(link).not.toHaveAttribute('type');
  });

  it('lets a caller override a class without leaving the conflicting one behind', () => {
    renderButton({ className: 'tw:px-8' });

    const { className } = screen.getByRole('button', { name: 'Save' });
    expect(className).toContain('tw:px-8');
    expect(className).not.toContain('tw:px-4');
  });

  it('passes axe', async () => {
    renderEveryButton();

    expect(await axeViolations()).toEqual([]);
  });
});
