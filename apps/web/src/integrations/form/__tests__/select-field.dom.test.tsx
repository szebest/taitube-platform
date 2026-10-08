import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useAppForm } from '../use-app-form';

const SIZES = ['small', 'large'] as const;

function SizeForm({ onSize }: { onSize: (size: string) => void }) {
  const form = useAppForm({
    defaultValues: { size: 'small' as (typeof SIZES)[number] },
    listeners: { onChange: ({ formApi }) => onSize(formApi.state.values.size) },
  });
  return (
    <form.AppField name="size">
      {(field) => <field.SelectField label="Size" ariaLabel="Pick a size" options={SIZES} />}
    </form.AppField>
  );
}

describe('apps/web: SelectField', () => {
  it('lists every option with the field value selected', () => {
    render(<SizeForm onSize={() => {}} />);

    const select = screen.getByLabelText<HTMLSelectElement>('Pick a size');
    expect(select.value).toBe('small');
    expect(screen.getAllByRole('option').map((option) => option.textContent)).toEqual([...SIZES]);
  });

  it('writes the chosen option into the field', async () => {
    const onSize = vi.fn();
    render(<SizeForm onSize={onSize} />);

    await userEvent.setup().selectOptions(screen.getByLabelText('Pick a size'), 'large');

    await vi.waitFor(() => expect(onSize).toHaveBeenLastCalledWith('large'));
  });
});
