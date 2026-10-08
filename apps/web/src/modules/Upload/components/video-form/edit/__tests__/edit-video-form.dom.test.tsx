import { cleanup, render, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { EditVideoForm, type EditVideoFormProps } from '../edit-video-form';

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

const FORM_DEFAULTS: EditVideoFormProps = {
  isError: false,
  isLoading: false,
  defaultValues: { title: 'A video', description: 'About something', visibility: 'public' },
  submit: () => {},
};

function renderForm(overrides: Partial<EditVideoFormProps> = {}) {
  return render(<EditVideoForm {...FORM_DEFAULTS} {...overrides} />);
}

function editButton(): HTMLButtonElement {
  return page().getByRole<HTMLButtonElement>('button', { name: 'upload' });
}

afterEach(cleanup);

describe('apps/web: edit video form', () => {
  it('asks for the title, the description and the visibility, filled with the video', () => {
    renderForm();

    expect(page().getByLabelText<HTMLInputElement>('Video title').value).toBe('A video');
    expect(page().getByLabelText<HTMLTextAreaElement>('Video description').value).toBe(
      'About something'
    );
    expect(page().getByLabelText<HTMLSelectElement>('Video visibility').value).toBe('public');
    expect(
      page()
        .getAllByRole('option')
        .map((option) => option.textContent)
    ).toEqual(['private', 'unlisted', 'public']);
  });

  it.each([
    { values: 'valid values', title: 'A video', disabled: false },
    { values: 'an empty title', title: '', disabled: true },
  ])('lets the edit through with $values: disabled=$disabled', ({ title, disabled }) => {
    renderForm({ defaultValues: { title, description: '', visibility: 'public' } });

    expect(editButton().disabled).toBe(disabled);
  });

  it('shows the rule message under a title the viewer cleared', async () => {
    renderForm();

    await user().clear(page().getByLabelText('Video title'));

    expect(await page().findByText('title must be between 1 and 200 characters')).toBeTruthy();
    expect(editButton().disabled).toBe(true);
  });

  it('submits the edited values', async () => {
    const submit = vi.fn();
    renderForm({ submit });

    await user().type(page().getByLabelText('Video title'), ' cut');
    await user().click(editButton());

    await vi.waitFor(() =>
      expect(submit).toHaveBeenCalledWith({
        title: 'A video cut',
        description: 'About something',
        visibility: 'public',
      })
    );
  });

  it('holds the edit button while the save is on its way', () => {
    renderForm({ isLoading: true });

    expect(editButton().disabled).toBe(true);
  });

  it('turns the button into a retry after a failed save', () => {
    renderForm({ isError: true });

    expect(page().getByRole('button', { name: 'retry' })).toBeTruthy();
    expect(page().queryByRole('button', { name: 'upload' })).toBeNull();
  });
});
