import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Accept } from 'react-dropzone';
import { useAppForm } from '../use-app-form';
import { WithUiCopy } from './with-ui-copy';

function FilesForm({ multiple = false, accept }: { multiple?: boolean; accept?: Accept }) {
  const form = useAppForm({ defaultValues: { files: [] as File[] } });
  return (
    <form.AppField name="files">
      {(field) => (
        <>
          <field.FileField
            accept={accept}
            multiple={multiple}
            placeholderText="Drop a video here"
          />
          <output>{field.state.value.map((file) => file.type).join(',')}</output>
        </>
      )}
    </form.AppField>
  );
}

function renderFilesForm(props: Parameters<typeof FilesForm>[0] = {}) {
  const user = userEvent.setup();
  return { user, ...render(<FilesForm {...props} />, { wrapper: WithUiCopy }) };
}

function fileInput(container: HTMLElement): HTMLInputElement {
  const input = container.querySelector<HTMLInputElement>('input[type="file"]');
  if (!input) throw new Error('the field has no file input');
  return input;
}

describe('@vp/forms: FileField', () => {
  it('invites a drop while no file is chosen', () => {
    renderFilesForm();

    expect(screen.getByText('Drop a video here')).toBeTruthy();
  });

  it.each([
    { names: ['clip.mp4'], multiple: false, heading: /^Selected file:$/ },
    { names: ['clip.mp4', 'outtake.mp4'], multiple: true, heading: /^Selected files:$/ },
  ])('lists the chosen files under $heading', async ({ names, multiple, heading }) => {
    const { container, user } = renderFilesForm({ multiple });

    await user.upload(
      fileInput(container),
      names.map((name) => new File(['bytes'], name))
    );

    expect(screen.getByText((_, element) => heading.test(element?.textContent ?? ''))).toBeTruthy();
    for (const name of names) expect(screen.getByText(name)).toBeTruthy();
    expect(screen.queryByText('Drop a video here')).toBeNull();
  });

  it('types a file the browser left typeless from the extension the accept map names', async () => {
    const { container, user } = renderFilesForm({ accept: { 'video/x-matroska': ['.mkv'] } });

    await user.upload(fileInput(container), new File(['bytes'], 'clip.mkv'));

    expect(screen.getByRole('status').textContent).toBe('video/x-matroska');
  });
});
