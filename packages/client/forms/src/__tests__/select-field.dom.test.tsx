import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useAppForm } from '../use-app-form';
import { WithUiCopy } from './with-ui-copy';

const SIZES = ['small', 'large'] as const;

function SizeForm({ onSize }: { onSize: (size: string) => void }) {
  const form = useAppForm({
    defaultValues: { size: 'small' as (typeof SIZES)[number] },
    listeners: { onChange: ({ formApi }) => onSize(formApi.state.values.size) },
  });
  return (
    <form.AppField name="size">
      {(field) => <field.SelectField label="Size" options={SIZES} />}
    </form.AppField>
  );
}

function renderSizeForm(onSize: (size: string) => void = () => {}) {
  const user = userEvent.setup();
  return { user, ...render(<SizeForm onSize={onSize} />, { wrapper: WithUiCopy }) };
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
});
