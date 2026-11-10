import type { CommentSettingsView } from '@vp/api-contracts';
import { useUpdateCommentSettings } from '@vp/queries';
import { useState } from 'react';

type Fields<Key extends keyof CommentSettingsView> = Pick<CommentSettingsView, Key>;

const sameValue = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

/**
 * One section of the comment settings: its own draft of the fields it owns, and its own save, which
 * replaces the document with the latest settings plus this draft, so another section's save is not undone.
 */
export function useSettingsSection<Key extends keyof CommentSettingsView>(
  settings: CommentSettingsView,
  keys: readonly Key[]
) {
  const update = useUpdateCommentSettings();
  const stored = Object.fromEntries(keys.map((key) => [key, settings[key]])) as Fields<Key>;
  const [draft, setDraft] = useState(stored);

  const dirty = keys.some((key) => !sameValue(draft[key], stored[key]));

  const change = (patch: Partial<Fields<Key>>) => {
    update.reset();
    setDraft({ ...draft, ...patch });
  };

  return {
    draft,
    change,
    dirty,
    saving: update.isPending,
    saved: update.isSuccess && !dirty,
    failed: update.isError,
    save: () => update.mutate({ ...settings, ...draft }),
  };
}
