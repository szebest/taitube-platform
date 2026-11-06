import { render, screen, within } from '@testing-library/react';
import { axeViolations } from '@vp/web-testing/dom';
import { AppProviders } from '#app/__tests__/providers';
import { ClipDialogView, type ClipDialogViewFooterProps } from '..';

interface DialogOptions extends Partial<ClipDialogViewFooterProps> {
  titleError?: string;
}

function renderDialog({ titleError, ...footer }: DialogOptions = {}) {
  render(
    <AppProviders>
      <ClipDialogView.Root defaultOpen title="Clip this video" description="Pick a stretch.">
        <ClipDialogView.Form>
          <ClipDialogView.TitleField
            label="Title"
            value="Launch day"
            onValueChange={() => undefined}
            error={titleError}
          />
          <ClipDialogView.Footer saveLabel="Save clip" canSave {...footer} />
        </ClipDialogView.Form>
      </ClipDialogView.Root>
    </AppProviders>
  );
  return screen.findByRole('dialog', { name: 'Clip this video' });
}

describe('apps/client/web: ClipDialogView', () => {
  it('has no axe violation open', async () => {
    await renderDialog();

    expect(await axeViolations()).toEqual([]);
  });

  it('marks the title invalid and says why', async () => {
    const dialog = await renderDialog({ titleError: 'Give the clip a title' });

    expect(within(dialog).getByRole('textbox', { name: 'Title' })).toBeInvalid();
    expect(within(dialog).getByText('Give the clip a title')).toBeInTheDocument();
  });

  it.each([
    { scenario: 'it can be saved', footer: {}, disabled: false },
    { scenario: 'it cannot be saved', footer: { canSave: false }, disabled: true },
  ])('enables Save clip only when $scenario', async ({ footer, disabled }) => {
    const dialog = await renderDialog(footer);

    expect(within(dialog).getByRole('button', { name: 'Save clip' }).hasAttribute('disabled')).toBe(
      disabled
    );
  });
});
