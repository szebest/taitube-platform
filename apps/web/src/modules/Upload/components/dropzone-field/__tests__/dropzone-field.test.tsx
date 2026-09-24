import { renderToStaticMarkup } from 'react-dom/server';
import { useForm } from 'react-hook-form';
import { DropzoneField } from '../dropzone-field';

type FilesForm = { file: File[] };

function FilesField({ files }: { files: File[] }) {
  const { control } = useForm<FilesForm>({ defaultValues: { file: files } });
  return <DropzoneField name="file" control={control} placeholderText="Drop a video here" />;
}

function renderField(files: File[]): string {
  return renderToStaticMarkup(<FilesField files={files} />);
}

describe('apps/web: dropzone field', () => {
  it('invites a drop while no file is chosen', () => {
    const markup = renderField([]);

    expect(markup).toContain('Drop a video here');
    expect(markup).toContain('type="file"');
  });

  it.each([
    { names: ['clip.mp4'], heading: 'Selected file:' },
    { names: ['clip.mp4', 'outtake.mp4'], heading: 'Selected files:' },
  ])('lists the chosen files under "$heading"', ({ names, heading }) => {
    const markup = renderField(names.map((name) => new File(['bytes'], name)));

    expect(markup).toContain(heading);
    for (const name of names) expect(markup).toContain(`<p>${name}</p>`);
    expect(markup).not.toContain('Drop a video here');
  });
});
