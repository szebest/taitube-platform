import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { AppProviders } from '#app/__tests__/providers';
import { CommentEditor, type CommentEditorProps } from '../comment-editor';

const onSave = vi.fn();
const onCancel = vi.fn();

const renderEditor = (props: Partial<CommentEditorProps> = {}) =>
  render(
    <AppProviders>
      <CommentEditor
        initial="First text"
        saving={false}
        onSave={onSave}
        onCancel={onCancel}
        {...props}
      />
    </AppProviders>
  );

describe('apps/client/web: comment editor', () => {
  it('saves the trimmed text only once it differs from what was posted', async () => {
    const user = userEvent.setup();
    renderEditor();
    const save = screen.getByRole('button', { name: 'Save' });

    expect(save).toBeDisabled();

    await user.type(screen.getByRole('textbox', { name: 'Edit comment' }), ' and more  ');
    await user.click(save);

    expect(onSave).toHaveBeenCalledWith('First text and more');
  });

  it('hands the edit back on cancel', async () => {
    renderEditor();

    await userEvent.setup().click(screen.getByRole('button', { name: 'Cancel' }));

    expect(onCancel).toHaveBeenCalledOnce();
  });
});
