import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { IntlProvider } from '@vp/intl-react';
import { VIDEO_ID } from '#app/__tests__/fixtures';
import { renderPage } from '#app/__tests__/render-page';
import { VideoForm, type VideoFormProps } from '../upload-video-form';

const FORM_DEFAULTS: VideoFormProps = {
  isError: false,
  isSuccess: false,
  progress: 0,
  reset: () => {},
  submit: () => {},
};

const clip = new File(['bytes'], 'clip.mp4', { type: 'video/mp4' });

function renderForm(overrides: Partial<VideoFormProps> = {}) {
  const { container } = render(
    <IntlProvider locale="en" timeZone="UTC">
      <VideoForm {...FORM_DEFAULTS} {...overrides} />
    </IntlProvider>
  );
  const fileInput = container.querySelector<HTMLInputElement>('input[type="file"]');
  if (!fileInput) throw new Error('the upload form has no file input');
  return { fileInput };
}

function uploadButton(): HTMLButtonElement {
  return screen.getByRole<HTMLButtonElement>('button', { name: 'upload' });
}

describe('apps/client/web: upload video form', () => {
  it('asks for a video file of a type the API accepts, a title and the visibility', () => {
    const { fileInput } = renderForm();

    expect(screen.getByText("Drag 'n' drop, or click to select video file")).toBeTruthy();
    expect(fileInput.accept).toBe(
      'video/mp4,.mp4,video/webm,.webm,video/quicktime,.mov,video/x-matroska,.mkv'
    );
    expect(screen.getByLabelText<HTMLSelectElement>('Video visibility').value).toBe('private');
  });

  it.each([
    { given: 'nothing', file: false, title: '', disabled: true },
    { given: 'a title only', file: false, title: 'Clip', disabled: true },
    { given: 'a file only', file: true, title: '', disabled: true },
    { given: 'a file and a title', file: true, title: 'Clip', disabled: false },
  ])(
    'holds the upload button given $given: disabled=$disabled',
    async ({ file, title, disabled }) => {
      const { fileInput } = renderForm();

      if (file) await userEvent.setup().upload(fileInput, clip);
      if (title) await userEvent.setup().type(screen.getByLabelText('Video title'), title);

      await vi.waitFor(() => expect(uploadButton().disabled).toBe(disabled));
    }
  );

  it('submits the chosen file with the title and the visibility', async () => {
    const submit = vi.fn();
    const { fileInput } = renderForm({ submit });

    await userEvent.setup().upload(fileInput, clip);
    await userEvent.setup().type(screen.getByLabelText('Video title'), 'Clip');
    await userEvent.setup().selectOptions(screen.getByLabelText('Video visibility'), 'public');
    await userEvent.setup().click(uploadButton());

    await vi.waitFor(() =>
      expect(submit).toHaveBeenCalledWith({ file: [clip], title: 'Clip', visibility: 'public' })
    );
    expect(screen.getByText('clip.mp4')).toBeTruthy();
  });

  it('shows the transfer progress once submitted', async () => {
    const { fileInput } = renderForm({ progress: 42.6 });

    await userEvent.setup().upload(fileInput, clip);
    await userEvent.setup().type(screen.getByLabelText('Video title'), 'Clip');
    await userEvent.setup().click(uploadButton());

    expect(await screen.findByText(/Progress: 43%/)).toBeTruthy();
  });

  it('turns the button into a retry after a failed upload', () => {
    renderForm({ isError: true });

    expect(screen.getByRole('button', { name: 'retry' })).toBeTruthy();
  });

  it('links to the uploaded video and offers another upload once done', async () => {
    const markup = await renderPage(
      <VideoForm {...FORM_DEFAULTS} isSuccess data={{ videoId: VIDEO_ID, status: 'UPLOADED' }} />
    );

    expect(markup).toContain(`href="/watch/${VIDEO_ID}"`);
    expect(markup).toContain('Submit another video');
    expect(markup).not.toContain('>Upload</button>');
  });
});
