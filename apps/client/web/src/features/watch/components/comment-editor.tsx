import { useT } from '@vp/intl-react';
import { Button, Textarea, useUiCopy } from '@vp/ui';
import { useState } from 'react';

export interface CommentEditorProps {
  initial: string;
  saving: boolean;
  onSave: (content: string) => void;
  onCancel: () => void;
}

/** The text of a comment being edited, saved only once it differs from what was posted. */
export function CommentEditor({ initial, saving, onSave, onCancel }: CommentEditorProps) {
  const { tOr } = useT();
  const { cancel } = useUiCopy();
  const [text, setText] = useState(initial);
  const content = text.trim();

  return (
    <form
      className="tw:flex tw:flex-col tw:gap-inline"
      onSubmit={(event) => {
        event.preventDefault();
        onSave(content);
      }}
    >
      <Textarea
        autoGrow
        rows={1}
        aria-label={tOr('watch.editCommentLabel', {}, '')}
        readOnly={saving}
        value={text}
        onChange={(event) => setText(event.target.value)}
      />
      <div className="tw:flex tw:justify-end tw:gap-inline">
        <Button variant="ghost" disabled={saving} onClick={onCancel}>
          {cancel}
        </Button>
        <Button
          type="submit"
          variant="solid"
          tone="accent"
          loading={saving}
          disabled={content.length === 0 || content === initial}
        >
          {tOr('watch.saveComment', {}, '')}
        </Button>
      </div>
    </form>
  );
}
