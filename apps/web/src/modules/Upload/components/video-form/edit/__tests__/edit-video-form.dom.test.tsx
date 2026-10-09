import { render, screen } from '@testing-library/react';
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
    { video: 'a short title', title: 'A video' },
    { video: 'the longest title the API accepts', title: 'x'.repeat(255) },
  ])('opens a video with $video ready to edit', ({ title }) => {
    renderForm({ defaultValues: { title, description: '', visibility: 'public' } });

    expect(editButton().disabled).toBe(false);
  });

  it('shows the rule message under a title the viewer cleared', async () => {
    renderForm();

    await userEvent.setup().clear(screen.getByLabelText('Video title'));

    expect(await screen.findByText('title must be between 1 and 255 characters')).toBeTruthy();
    expect(editButton().disabled).toBe(true);
  });

  it('submits the edited values', async () => {
    const submit = vi.fn();
    renderForm({ submit });

    await userEvent.setup().type(screen.getByLabelText('Video title'), ' cut');
    await userEvent.setup().click(editButton());

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

    expect(screen.getByRole('button', { name: 'retry' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'upload' })).toBeNull();
  });
});
