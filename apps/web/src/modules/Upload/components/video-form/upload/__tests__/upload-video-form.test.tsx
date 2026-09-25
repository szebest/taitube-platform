import { VIDEO_ID } from '#app/__tests__/fixtures';
import { renderPage } from '#app/__tests__/render-page';
import { VideoForm, type VideoFormProps } from '../upload-video-form';

async function renderForm(overrides: Partial<VideoFormProps> = {}): Promise<string> {
  return renderPage(
    <VideoForm
      isError={false}
      isSuccess={false}
      reset={() => {}}
      submit={() => {}}
      {...overrides}
    />
  );
}

describe('apps/web: upload video form', () => {
  it('asks for a video file, a title and the visibility', async () => {
    const markup = await renderForm();

    expect(markup).toContain('click to select video file');
    expect(markup).toContain('accept="video/mp4,.mp4"');
    expect(markup).toContain('Video title');
    expect(markup).toContain('aria-label="Video visibility"');
  });

  it('holds the upload button until a file and a title are given', async () => {
    const markup = await renderForm();

    expect(markup).toContain('>Upload</button>');
    expect(markup).toContain('disabled=""');
  });

  it('turns the button into a retry after a failed upload', async () => {
    expect(await renderForm({ isError: true })).toContain('aria-label="retry"');
  });

  it('links to the uploaded video and offers another upload once done', async () => {
    const markup = await renderForm({
      isSuccess: true,
      data: { videoId: VIDEO_ID, status: 'UPLOADED' },
    });

    expect(markup).toContain(`href="/watch/${VIDEO_ID}"`);
    expect(markup).toContain('Submit another video');
    expect(markup).not.toContain('>Upload</button>');
  });
});
