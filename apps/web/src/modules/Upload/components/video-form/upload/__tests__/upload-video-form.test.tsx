// @vitest-environment jsdom
import { cleanup, render, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { IntlProvider } from '@vp/intl-react';
import { VIDEO_ID } from '#app/__tests__/fixtures';
import { renderPage } from '#app/__tests__/render-page';
import { VideoForm, type VideoFormProps } from '../upload-video-form';

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
  return page().getByRole<HTMLButtonElement>('button', { name: 'upload' });
}

afterEach(cleanup);

describe('apps/web: upload video form', () => {
  it('asks for a video file of a type the API accepts, a title and the visibility', () => {
    const { fileInput } = renderForm();

    expect(page().getByText("Drag 'n' drop, or click to select video file")).toBeTruthy();
    expect(fileInput.accept).toBe('video/mp4,video/webm,video/quicktime,video/x-matroska');
    expect(page().getByLabelText<HTMLSelectElement>('Video visibility').value).toBe('private');
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

      if (file) await user().upload(fileInput, clip);
      if (title) await user().type(page().getByLabelText('Video title'), title);

      await vi.waitFor(() => expect(uploadButton().disabled).toBe(disabled));
    }
  );

  it('submits the chosen file with the title and the visibility', async () => {
    const submit = vi.fn();
    const { fileInput } = renderForm({ submit });

    await user().upload(fileInput, clip);
    await user().type(page().getByLabelText('Video title'), 'Clip');
    await user().selectOptions(page().getByLabelText('Video visibility'), 'public');
    await user().click(uploadButton());

    await vi.waitFor(() =>
      expect(submit).toHaveBeenCalledWith({ file: [clip], title: 'Clip', visibility: 'public' })
    );
    expect(page().getByText('clip.mp4')).toBeTruthy();
  });

  it('shows the transfer progress once submitted', async () => {
    const { fileInput } = renderForm({ progress: 42.6 });

    await user().upload(fileInput, clip);
    await user().type(page().getByLabelText('Video title'), 'Clip');
    await user().click(uploadButton());

    expect(await page().findByText(/Progress: 43%/)).toBeTruthy();
  });

  it('turns the button into a retry after a failed upload', () => {
    renderForm({ isError: true });

    expect(page().getByRole('button', { name: 'retry' })).toBeTruthy();
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
