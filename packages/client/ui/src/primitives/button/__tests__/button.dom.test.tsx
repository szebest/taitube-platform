import { render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { axeViolations } from '@vp/web-testing/dom';
import { variantNames } from '../../../lib/variant-names';
import { Button, type ButtonProps } from '../button';
import { buttonStyles } from '../button.variants';

function renderButton(
  props: ButtonProps = {},
  { onSubmit }: { onSubmit?: (event: SubmitEvent) => void } = {}
) {
  const user = userEvent.setup();
  const button = <Button {...{ children: 'Save', ...props }} />;
  return {
    user,
    ...render(
      onSubmit ? (
        <form onSubmit={(event) => onSubmit(event.nativeEvent as SubmitEvent)}>{button}</form>
      ) : (
        button
      )
    ),
  };
}

describe('@vp/ui: Button', () => {
  it('renders a button of type button, named by its label', () => {
    renderButton();

    expect(screen.getByRole('button', { name: 'Save' })).toHaveAttribute('type', 'button');
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

  it('keeps a loading button named and busy, deaf to clicks and to its form', async () => {
    const onClick = vi.fn();
    const onSubmit = vi.fn((event: SubmitEvent) => event.preventDefault());
    const { user } = renderButton({ type: 'submit', loading: true, onClick }, { onSubmit });

    const button = screen.getByRole('button', { name: 'Save' });
    await user.click(button);

    expect(button).toHaveAttribute('aria-busy', 'true');
    expect(onClick).not.toHaveBeenCalled();
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
    renderButton({
      asChild: true,
      variant: 'solid',
      tone: 'accent',
      children: <a href="/upload">Upload</a>,
    });

    const link = screen.getByRole('link', { name: 'Upload' });
    expect(link).toHaveClass('tw:bg-accent');
    expect(link).not.toHaveAttribute('type');
  });

  it('lets a caller override a class without leaving the conflicting one behind', () => {
    renderButton({ className: 'tw:px-8' });

    const { className } = screen.getByRole('button', { name: 'Save' });
    expect(className).toContain('tw:px-8');
    expect(className).not.toContain('tw:px-inset-control');
  });

  it('passes axe in every fill and tone', async () => {
    for (const variant of variantNames(buttonStyles.variants.variant)) {
      for (const tone of variantNames(buttonStyles.variants.tone)) {
        renderButton({ variant, tone, children: `${variant} ${tone}` });
      }
    }
    renderButton({ disabled: true, children: 'Disabled' });

    expect(await axeViolations()).toEqual([]);
  });
});
