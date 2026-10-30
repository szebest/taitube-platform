import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AppWords } from '@vp/queries';
import { VIDEO_ID } from '@vp/web-testing';

import { VideoForm, type VideoFormProps } from '../upload-video-form';

const FORM_DEFAULTS: VideoFormProps = {
  isError: false,
  isSuccess: false,
  progress: 0,
  reset: () => {},
  cancel: () => {},
  submit: () => {},
};

const clip = new File(['bytes'], 'clip.mp4', { type: 'video/mp4' });

function renderForm(overrides: Partial<VideoFormProps> = {}) {
  const user = userEvent.setup();
  const { container } = render(
    <AppWords>
      <VideoForm {...FORM_DEFAULTS} {...overrides} />
    </AppWords>
  );
  return {
    user,
    container,
    get fileInput() {
      const input = container.querySelector<HTMLInputElement>('input[type="file"]');
      if (!input) throw new Error('the upload form has no file input');
      return input;
    },
  };
}

function uploadButton(): HTMLButtonElement {
  return screen.getByRole<HTMLButtonElement>('button', { name: 'upload' });
}

describe('apps/client/studio: upload video form', () => {
  it('asks for a video file of a type the API accepts, a title and the visibility', () => {
    const { fileInput } = renderForm();

    expect(screen.getByText("Drag 'n' drop, or click to select video file")).toBeTruthy();
    expect(fileInput.accept).toBe(
      'video/mp4,.mp4,video/webm,.webm,video/quicktime,.mov,video/x-matroska,.mkv'
    );
    expect(screen.getByRole('combobox', { name: 'Video visibility' })).toHaveTextContent('private');
  });

  it.each([
    { given: 'nothing', file: false, title: '', disabled: true },
    { given: 'a title only', file: false, title: 'Clip', disabled: true },
    { given: 'a file only', file: true, title: '', disabled: true },
    { given: 'a file and a title', file: true, title: 'Clip', disabled: false },
  ])(
    'holds the upload button given $given: disabled=$disabled',
    async ({ file, title, disabled }) => {
      const { fileInput, user } = renderForm();

      if (file) await user.upload(fileInput, clip);
      if (title) await user.type(screen.getByLabelText('Video title'), title);

      await vi.waitFor(() => expect(uploadButton().disabled).toBe(disabled));
    }
  );

  it('submits the chosen file with the title and the visibility', async () => {
    const submit = vi.fn();
    const { fileInput, user } = renderForm({ submit });

    await user.upload(fileInput, clip);
    await user.type(screen.getByLabelText('Video title'), 'Clip');
    await user.click(screen.getByRole('combobox', { name: 'Video visibility' }));
    await user.click(await screen.findByRole('option', { name: 'public' }));
    await user.click(uploadButton());

    await vi.waitFor(() =>
      expect(submit).toHaveBeenCalledWith({ file: [clip], title: 'Clip', visibility: 'public' })
    );
    expect(screen.getByText('clip.mp4')).toBeTruthy();
  });

  it('shows the transfer progress once submitted', async () => {
    const { fileInput, user } = renderForm({ progress: 42.6 });

    await user.upload(fileInput, clip);
    await user.type(screen.getByLabelText('Video title'), 'Clip');
    await user.click(uploadButton());

    expect(await screen.findByText(/Progress: 43%/)).toBeTruthy();
  });

  it('cancels the transfer and returns to a blank form', async () => {
    const cancel = vi.fn();
    const reset = vi.fn();
    const { fileInput, user } = renderForm({ cancel, reset });

    await user.upload(fileInput, clip);
    await user.type(screen.getByLabelText('Video title'), 'Clip');
    await user.click(uploadButton());
    await user.click(await screen.findByRole('button', { name: 'cancel upload' }));

    expect(cancel).toHaveBeenCalledOnce();
    expect(reset).toHaveBeenCalledOnce();
    expect(uploadButton().disabled).toBe(true);
    expect(screen.queryByRole('button', { name: 'cancel upload' })).toBeNull();
  });

  it('turns the button into a retry after a failed upload', () => {
    renderForm({ isError: true });

    expect(screen.getByRole('button', { name: 'retry' })).toBeTruthy();
  });

  it('links to the uploaded video on the viewer app and offers another upload once done', () => {
    const { container } = renderForm({
      isSuccess: true,
      data: { videoId: VIDEO_ID, status: 'UPLOADED' },
    });
    const markup = container.innerHTML;

    expect(markup).toContain(`href="http://localhost:5173/watch/${VIDEO_ID}"`);
    expect(markup).toContain('Submit another video');
    expect(markup).not.toContain('>Upload</button>');
  });
});
