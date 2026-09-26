// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { EditVideoForm, type EditVideoFormProps } from '../edit-video-form';

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
  return screen.getByRole<HTMLButtonElement>('button', { name: 'upload' });
}

afterEach(cleanup);

describe('apps/web: edit video form', () => {
  it('asks for the title, the description and the visibility, filled with the video', () => {
    renderForm();

    expect(screen.getByLabelText<HTMLInputElement>('Video title').value).toBe('A video');
    expect(screen.getByLabelText<HTMLTextAreaElement>('Video description').value).toBe(
      'About something'
    );
    expect(screen.getByLabelText<HTMLSelectElement>('Video visibility').value).toBe('public');
    expect(screen.getAllByRole('option').map((option) => option.textContent)).toEqual([
      'private',
      'unlisted',
      'public',
    ]);
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

    await userEvent.clear(screen.getByLabelText('Video title'));

    expect(editButton().disabled).toBe(true);
    expect(screen.getByText('title must be between 1 and 200 characters')).toBeTruthy();
  });

  it('submits the edited values', async () => {
    const submit = vi.fn();
    renderForm({ submit });

    await userEvent.type(screen.getByLabelText('Video title'), ' cut');
    await userEvent.click(editButton());

    expect(submit).toHaveBeenCalledWith({
      title: 'A video cut',
      description: 'About something',
      visibility: 'public',
    });
  });

  it('holds the edit button while the save is on its way', () => {
    renderForm({ isLoading: true });

    expect(editButton().disabled).toBe(true);
  });

  it('turns the button into a retry after a failed save', () => {
    renderForm({ isError: true });

    expect(screen.getByRole('button', { name: 'retry' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'upload' })).toBeNull();
  });
});
