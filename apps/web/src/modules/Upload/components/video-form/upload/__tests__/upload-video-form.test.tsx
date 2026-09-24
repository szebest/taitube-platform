import { VIDEO_ID } from '../../../../../../__tests__/fixtures';
import { renderPage } from '../../../../../../__tests__/render-page';
import { VideoForm, type VideoFormProps } from '../upload-video-form';

function renderForm(overrides: Partial<VideoFormProps> = {}): string {
  return renderPage(<VideoForm isError={false} isSuccess={false} reset={() => {}} submit={() => {}} {...overrides} />);
}

describe('apps/web: upload video form', () => {
  it('asks for a video file, a title and the visibility', () => {
    const markup = renderForm();

    expect(markup).toContain('click to select video file');
    expect(markup).toContain('accept="video/mp4,.mp4"');
    expect(markup).toContain('Video title');
    expect(markup).toContain('aria-label="Video visibility"');
  });

  it('holds the upload button until a file and a title are given', () => {
    const markup = renderForm();

    expect(markup).toContain('>Upload</button>');
    expect(markup).toContain('disabled=""');
  });

  it('turns the button into a retry after a failed upload', () => {
    expect(renderForm({ isError: true })).toContain('aria-label="retry"');
  });

  it('links to the uploaded video and offers another upload once done', () => {
    const markup = renderForm({ isSuccess: true, data: { videoId: VIDEO_ID, status: 'UPLOADED' } });

    expect(markup).toContain(`href="/watch/${VIDEO_ID}"`);
    expect(markup).toContain('Submit another video');
    expect(markup).not.toContain('>Upload</button>');
  });
});
