import { Field, Switch } from '@kit/ui';
import { useT } from '#app/lib/messages';
import { usePostComposer } from './post-composer.context';

/** Whether viewers may reply to the post. */
export function PostComposerComments() {
  const { tOr } = useT();
  const { draft, change } = usePostComposer('Comments');

  return (
    <Field.Root orientation="horizontal">
      <Field.Label>{tOr('studio.composerCommentsEnabled', {}, '')}</Field.Label>
      <Switch
        checked={draft.commentsEnabled}
        onCheckedChange={(commentsEnabled) => change({ commentsEnabled })}
      />
    </Field.Root>
  );
}
