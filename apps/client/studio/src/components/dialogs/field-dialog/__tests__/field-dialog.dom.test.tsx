import { axeViolations } from '@kit/web-testing/dom';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AppProviders } from '#app/__tests__/providers';
import { FieldDialog, type FieldDialogProps } from '../field-dialog';

const CHOICE: FieldDialogProps['input'] = {
  kind: 'choice',
  options: [
    { value: 'public', label: 'Public' },
    { value: 'private', label: 'Private' },
  ],
};

const renderDialog = (props: Partial<FieldDialogProps> = {}) => {
  const handlers = { onOpenChange: vi.fn(), onSubmit: vi.fn() };
  render(
    <FieldDialog
      open
      title="Change visibility"
      description="Applies to 2 selected videos."
      label="Visibility"
      input={CHOICE}
      submitLabel="Apply"
      {...handlers}
      {...props}
    />,
    { wrapper: AppProviders }
  );
  return { user: userEvent.setup(), ...handlers };
};

describe('apps/client/studio: FieldDialog', () => {
  it('names the change and the number of videos it applies to', () => {
    renderDialog();

    expect(screen.getByRole('dialog', { name: 'Change visibility' })).toHaveAccessibleDescription(
      'Applies to 2 selected videos.'
    );
  });

  it('submits the first option of a choice until another is picked', async () => {
    const { user, onSubmit } = renderDialog();

    await user.click(screen.getByRole('button', { name: 'Apply' }));
    expect(onSubmit).toHaveBeenLastCalledWith('public');

    await user.click(screen.getByRole('combobox', { name: /Visibility/ }));
    await user.click(await screen.findByRole('option', { name: 'Private' }));
    await user.click(screen.getByRole('button', { name: 'Apply' }));

    expect(onSubmit).toHaveBeenLastCalledWith('private');
  });

  it('submits the trimmed text, and holds the button while it is blank', async () => {
    const { user, onSubmit } = renderDialog({
      label: 'Tags',
      input: { kind: 'text', hint: 'Separate tags with commas.' },
    });
    const apply = screen.getByRole('button', { name: 'Apply' });

    expect(apply).toBeDisabled();
    expect(screen.getByText('Separate tags with commas.')).toBeInTheDocument();

    await user.type(screen.getByRole('textbox', { name: /Tags/ }), '  travel, food ');
    await user.click(apply);

    expect(onSubmit).toHaveBeenCalledWith('travel, food');
  });

  it('closes on cancel without submitting', async () => {
    const { user, onOpenChange, onSubmit } = renderDialog();

    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('is not on the page while closed, and has no accessibility violations open', async () => {
    const closed = render(
      <FieldDialog
        open={false}
        onOpenChange={vi.fn()}
        title="t"
        label="l"
        input={CHOICE}
        submitLabel="s"
        onSubmit={vi.fn()}
      />,
      { wrapper: AppProviders }
    );
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    closed.unmount();

    renderDialog();

    expect(await axeViolations()).toEqual([]);
  });
});
