import { Field, Tabs, Textarea } from '@kit/ui';
import { useT } from '#app/lib/messages';
import { POST_LIMITS } from './constants';
import { PostComposerCount } from './post-composer-count';
import { usePostComposer } from './post-composer.context';

/** The words of a text post. */
export function PostComposerText() {
  const { tOr } = useT();
  const { draft, change } = usePostComposer('Text');

  return (
    <Tabs.Panel value="text">
      <Field.Root required invalid={draft.text.length > POST_LIMITS.text}>
        <Field.Label>{tOr('studio.composerTextLabel', {}, '')}</Field.Label>
        <Textarea
          autoGrow
          value={draft.text}
          onChange={(event) => change({ text: event.target.value })}
        />
        <Field.Hint>
          <PostComposerCount length={draft.text.length} max={POST_LIMITS.text} />
        </Field.Hint>
      </Field.Root>
    </Tabs.Panel>
  );
}
