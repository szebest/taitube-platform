// @vitest-environment jsdom
import { cleanup, render, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useAppForm } from '../use-app-form';

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

function FilesForm({ multiple = false }: { multiple?: boolean }) {
  const form = useAppForm({ defaultValues: { files: [] as File[] } });
  return (
    <form.AppField name="files">
      {(field) => <field.FileField multiple={multiple} placeholderText="Drop a video here" />}
    </form.AppField>
  );
}

function fileInput(container: HTMLElement): HTMLInputElement {
  const input = container.querySelector<HTMLInputElement>('input[type="file"]');
  if (!input) throw new Error('the field has no file input');
  return input;
}

afterEach(cleanup);

describe('apps/web: FileField', () => {
  it('invites a drop while no file is chosen', () => {
    render(<FilesForm />);

    expect(page().getByText('Drop a video here')).toBeTruthy();
  });

  it.each([
    { names: ['clip.mp4'], multiple: false, heading: /^Selected file:$/ },
    { names: ['clip.mp4', 'outtake.mp4'], multiple: true, heading: /^Selected files:$/ },
  ])('lists the chosen files under $heading', async ({ names, multiple, heading }) => {
    const { container } = render(<FilesForm multiple={multiple} />);

    await user().upload(
      fileInput(container),
      names.map((name) => new File(['bytes'], name))
    );

    expect(page().getByText((_, element) => heading.test(element?.textContent ?? ''))).toBeTruthy();
    for (const name of names) expect(page().getByText(name)).toBeTruthy();
    expect(page().queryByText('Drop a video here')).toBeNull();
  });
});
