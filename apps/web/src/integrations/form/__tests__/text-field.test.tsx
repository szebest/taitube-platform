// @vitest-environment jsdom
import { cleanup, render, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ErrorCodes } from '@vp/errors';
import { err, ok } from '@vp/result';
import { useAppForm } from '../use-app-form';
import { validateWith } from '../validate-with';

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

const requireText = validateWith((text: string) =>
  text ? ok(text) : err({ code: ErrorCodes.VALIDATION_FAILED, message: 'Say something' })
);

function NoteForm({ multiline = false }: { multiline?: boolean }) {
  const form = useAppForm({ defaultValues: { note: 'Hello' } });
  return (
    <form.AppField name="note" validators={{ onChange: requireText }}>
      {(field) => <field.TextField label="Note" multiline={multiline} />}
    </form.AppField>
  );
}

afterEach(cleanup);

describe('apps/web: TextField', () => {
  it.each([
    { control: 'a text input', multiline: false, tag: 'INPUT' },
    { control: 'a textarea', multiline: true, tag: 'TEXTAREA' },
  ])('labels $control holding the field value', ({ multiline, tag }) => {
    render(<NoteForm multiline={multiline} />);

    const control = page().getByLabelText<HTMLInputElement>('Note');
    expect(control.tagName).toBe(tag);
    expect(control.value).toBe('Hello');
  });

  it('shows the validator message once the viewer has touched the field', async () => {
    render(<NoteForm />);

    await user().clear(page().getByLabelText('Note'));

    expect(await page().findByText('Say something')).toBeTruthy();
  });
});
