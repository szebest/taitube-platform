import { renderToStaticMarkup } from 'react-dom/server';
import { EditVideoForm, type EditVideoFormProps } from '../edit-video-form';

function renderForm(overrides: Partial<EditVideoFormProps> = {}): string {
  return renderToStaticMarkup(
    <EditVideoForm
      isError={false}
      isLoading={false}
      defaultValues={{ title: 'A video', description: 'About something', visibility: 'public' }}
      submit={() => {}}
      {...overrides}
    />
  );
}

describe('apps/web: edit video form', () => {
  it('asks for the title, the description and the visibility', () => {
    const markup = renderForm();

    expect(markup).toContain('Video title');
    expect(markup).toContain('Video description');
    for (const visibility of ['private', 'unlisted', 'public']) {
      expect(markup).toContain(`<option value="${visibility}">${visibility}</option>`);
    }
  });

  it('holds the edit button until the form has been validated', () => {
    const markup = renderForm();

    expect(markup).toContain('>Edit</button>');
    expect(markup).toContain('disabled=""');
  });

  it('turns the button into a retry after a failed save', () => {
    const markup = renderForm({ isError: true });

    expect(markup).toContain('aria-label="retry"');
    expect(markup).not.toContain('>Edit</button>');
  });
});
