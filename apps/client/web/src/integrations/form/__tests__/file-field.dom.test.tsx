import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Accept } from 'react-dropzone';
import { useAppForm } from '../use-app-form';

function FilesForm({ multiple = false, accept }: { multiple?: boolean; accept?: Accept }) {
  const form = useAppForm({ defaultValues: { files: [] as File[] } });
  return (
    <form.AppField name="files">
      {(field) => (
        <>
          <field.FileField accept={accept} multiple={multiple} placeholderText="Drop a video here" />
          <output>{field.state.value.map((file) => file.type).join(',')}</output>
        </>
      )}
    </form.AppField>
  );
}

function fileInput(container: HTMLElement): HTMLInputElement {
  const input = container.querySelector<HTMLInputElement>('input[type="file"]');
  if (!input) throw new Error('the field has no file input');
  return input;
}

describe('apps/client/web: FileField', () => {
  it('invites a drop while no file is chosen', () => {
    render(<FilesForm />);

    expect(screen.getByText('Drop a video here')).toBeTruthy();
  });

  it.each([
    { names: ['clip.mp4'], multiple: false, heading: /^Selected file:$/ },
    { names: ['clip.mp4', 'outtake.mp4'], multiple: true, heading: /^Selected files:$/ },
  ])('lists the chosen files under $heading', async ({ names, multiple, heading }) => {
    const { container } = render(<FilesForm multiple={multiple} />);

    await userEvent.setup().upload(
      fileInput(container),
      names.map((name) => new File(['bytes'], name))
    );

    expect(screen.getByText((_, element) => heading.test(element?.textContent ?? ''))).toBeTruthy();
    for (const name of names) expect(screen.getByText(name)).toBeTruthy();
    expect(screen.queryByText('Drop a video here')).toBeNull();
  });

  it('types a file the browser left typeless from the extension the accept map names', async () => {
    const { container } = render(<FilesForm accept={{ 'video/x-matroska': ['.mkv'] }} />);

    await userEvent.setup().upload(fileInput(container), new File(['bytes'], 'clip.mkv'));

    expect(screen.getByRole('status').textContent).toBe('video/x-matroska');
  });
});
