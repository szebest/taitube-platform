import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useAppForm } from '../use-app-form';
import { WithUiCopy } from './with-ui-copy';

const SIZES = ['small', 'large'] as const;

function SizeForm({
  onSize,
  labelOf,
}: {
  onSize: (size: string) => void;
  labelOf?: (size: (typeof SIZES)[number]) => string;
}) {
  const form = useAppForm({
    defaultValues: { size: 'small' as (typeof SIZES)[number] },
    listeners: { onChange: ({ formApi }) => onSize(formApi.state.values.size) },
  });
  return (
    <form.AppField name="size">
      {(field) => <field.SelectField label="Size" options={SIZES} labelOf={labelOf} />}
    </form.AppField>
  );
}

function renderSizeForm(
  onSize: (size: string) => void = () => {},
  labelOf?: (size: (typeof SIZES)[number]) => string
) {
  const user = userEvent.setup();
  return { user, ...render(<SizeForm onSize={onSize} labelOf={labelOf} />, { wrapper: WithUiCopy }) };
}

describe('@vp/forms: SelectField', () => {
  it('shows the field value in a combobox named by the label, and lists every option', async () => {
    const { user } = renderSizeForm();

    const select = screen.getByRole('combobox', { name: 'Size' });
    expect(select).toHaveTextContent('small');

    await user.click(select);

    expect(screen.getAllByRole('option').map((option) => option.textContent)).toEqual([...SIZES]);
  });

  it('writes the chosen option into the field', async () => {
    const onSize = vi.fn();
    const { user } = renderSizeForm(onSize);

    await user.click(screen.getByRole('combobox', { name: 'Size' }));
    await user.click(screen.getByRole('option', { name: 'large' }));

    await vi.waitFor(() => expect(onSize).toHaveBeenLastCalledWith('large'));
  });

  it('prints the label an option is given, and still writes its value', async () => {
    const onSize = vi.fn();
    const { user } = renderSizeForm(onSize, (size) => size.toUpperCase());

    await user.click(screen.getByRole('combobox', { name: 'Size' }));
    expect(screen.getAllByRole('option').map((option) => option.textContent)).toEqual([
      'SMALL',
      'LARGE',
    ]);
    await user.click(screen.getByRole('option', { name: 'LARGE' }));

    await vi.waitFor(() => expect(onSize).toHaveBeenLastCalledWith('large'));
  });
});
