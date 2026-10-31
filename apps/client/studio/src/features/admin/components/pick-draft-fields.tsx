import { usePickWindowText } from '#app/features/admin/hooks/use-pick-window-text';
import type { PickDraft } from '#app/features/admin/lib/pick-draft';
import { fromLocalInput, type WindowIssue } from '#app/features/admin/lib/pick-schedule';
import { PickNoteField } from './pick-note-field';
import { PickPreview } from './pick-preview';
import { PickVideoPicker } from './pick-video-picker';
import { PickWindowFields } from './pick-window-fields';

export interface ShownIssues {
  video: string | undefined;
  window: WindowIssue | undefined;
  note: boolean;
}

export interface PickDraftFieldsProps {
  draft: PickDraft;
  onChange: (changes: Partial<PickDraft>) => void;
  issues: ShownIssues;
}

/** The fields of a pick and the spotlight they produce, one under the other. */
export function PickDraftFields({ draft, onChange, issues }: PickDraftFieldsProps) {
  const windowText = usePickWindowText();
  const from = fromLocalInput(draft.startsAt);
  const to = fromLocalInput(draft.endsAt);
  const preview =
    from && to ? windowText({ startsAt: from.toISOString(), endsAt: to.toISOString() }) : '';

  return (
    <div className="tw:flex tw:flex-col tw:gap-section">
      <PickVideoPicker
        selected={draft.video}
        onSelect={(video) => onChange({ video })}
        error={issues.video}
      />
      <PickWindowFields
        startsAt={draft.startsAt}
        endsAt={draft.endsAt}
        onChange={onChange}
        issue={issues.window}
      />
      <PickNoteField
        value={draft.note}
        onChange={(note) => onChange({ note })}
        refused={issues.note}
      />
      <PickPreview video={draft.video} note={draft.note} window={preview} />
    </div>
  );
}
