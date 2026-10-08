// @vitest-environment jsdom
import { cleanup, render, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useAppForm } from '../use-app-form';

/**
 * Bound to the current document on every call: with `isolate: false`, the module-level `screen` and
 * `userEvent` can still hold an earlier spec's document.
 */
function page() {
  return within(document.body);
}

function user() {
  return userEvent.setup({ document });
}

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

afterEach(cleanup);

describe('apps/web: SelectField', () => {
  it('lists every option with the field value selected', () => {
    render(<SizeForm onSize={() => {}} />);

    const select = page().getByLabelText<HTMLSelectElement>('Pick a size');
    expect(select.value).toBe('small');
    expect(
      page()
        .getAllByRole('option')
        .map((option) => option.textContent)
    ).toEqual([...SIZES]);
  });

  it('writes the chosen option into the field', async () => {
    const onSize = vi.fn();
    render(<SizeForm onSize={onSize} />);

    await user().selectOptions(page().getByLabelText('Pick a size'), 'large');

    await vi.waitFor(() => expect(onSize).toHaveBeenLastCalledWith('large'));
  });
});
