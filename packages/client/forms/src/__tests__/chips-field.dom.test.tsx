import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useAppForm } from '../use-app-form';
import { WithUiCopy } from './with-ui-copy';

function TagsForm({ onTags, initial }: { onTags: (tags: string[]) => void; initial: string[] }) {
  const form = useAppForm({
    defaultValues: { tags: initial },
    listeners: { onChange: ({ formApi }) => onTags(formApi.state.values.tags) },
  });
  return (
    <form.AppField
      name="tags"
      validators={{ onChange: ({ value }) => (value.length > 2 ? 'Too many tags' : undefined) }}
    >
      {(field) => (
        <field.ChipsField
          label="Tags"
          placeholder="Add a tag"
          removeLabel={(tag) => `Remove ${tag}`}
        />
      )}
    </form.AppField>
  );
}

function renderTags(initial: string[] = []) {
  const onTags = vi.fn();
  const user = userEvent.setup();
  render(<TagsForm onTags={onTags} initial={initial} />, { wrapper: WithUiCopy });
  return { user, onTags };
}

describe('@vp/forms: ChipsField', () => {
  it('lists the field value as chips under the label', () => {
    renderTags(['music', 'live']);

    expect(screen.getByRole('textbox', { name: 'Tags' })).toBeInTheDocument();
    expect(screen.getAllByRole('button').map((chip) => chip.textContent)).toEqual([
      'music',
      'live',
    ]);
  });

  it('adds the trimmed draft on Enter, once, and empties the input', async () => {
    const { user, onTags } = renderTags(['music']);
    const input = screen.getByRole('textbox', { name: 'Tags' });

    await user.type(input, '  live {Enter}');
    await user.type(input, 'live{Enter}');

    expect(onTags).toHaveBeenLastCalledWith(['music', 'live']);
    expect(input).toHaveValue('');
  });

  it('keeps a draft that is left on blur as a chip', async () => {
    const { user, onTags } = renderTags();

    await user.type(screen.getByRole('textbox', { name: 'Tags' }), 'gaming');
    await user.tab();

    expect(onTags).toHaveBeenLastCalledWith(['gaming']);
  });

  it('removes a chip when it is pressed', async () => {
    const { user, onTags } = renderTags(['music', 'live']);

    await user.click(screen.getByRole('button', { name: 'Remove music' }));

    expect(onTags).toHaveBeenLastCalledWith(['live']);
  });

  it('shows the validation error once the field was touched', async () => {
    const { user } = renderTags(['a', 'b']);

    await user.type(screen.getByRole('textbox', { name: 'Tags' }), 'c{Enter}');
    await user.tab();

    expect(await screen.findByText('Too many tags')).toBeInTheDocument();
  });
});
