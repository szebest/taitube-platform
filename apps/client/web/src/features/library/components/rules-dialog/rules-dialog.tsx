import { useAppForm } from '@kit/forms';
import { Button, useToast } from '@kit/ui';
import type { PlaylistView } from '@vp/api-contracts';
import { failureCode, present } from '@vp/queries';
import { useSavePlaylistSettings } from '#app/features/library/hooks/use-save-playlist-settings';
import {
  draftToRules,
  rulesToDraft,
  validateRulesDraft,
} from '#app/features/library/utils/rules-form';
import { useT } from '#app/lib/messages';
import { urlModals } from '#app/lib/url-modal/registry';
import { SmartRulesEditor } from '../smart-rules-editor/smart-rules-editor';

const { UrlModal, useUrlModal } = urlModals;

export interface RulesDialogProps {
  playlist: PlaylistView;
}

function RulesForm({ playlist }: RulesDialogProps) {
  const { tOr } = useT();
  const showToast = useToast();
  const { close } = useUrlModal('playlist-rules');
  const save = useSavePlaylistSettings(playlist.id);

  const form = useAppForm({
    defaultValues: { rules: rulesToDraft(playlist.rules) },
    onSubmit: ({ value }) =>
      save.mutate(
        { rules: draftToRules(value.rules) },
        {
          onSuccess: () => {
            showToast({ tone: 'success', title: tOr('playlistTools.rulesSaved', {}, '') });
            close();
          },
        }
      ),
  });
  const problem = save.isError
    ? tOr(present({ code: failureCode(save.error) }).copy, {}, '')
    : null;

  return (
    <form
      className="flex flex-col gap-stack"
      onSubmit={(event) => {
        event.preventDefault();
        event.stopPropagation();
        void form.handleSubmit();
      }}
    >
      <form.Field
        name="rules"
        validators={{ onMount: validateRulesDraft, onChange: validateRulesDraft }}
      >
        {(field) => <SmartRulesEditor value={field.state.value} onChange={field.handleChange} />}
      </form.Field>
      {problem && (
        <p role="alert" className="m-0 text-caption text-danger-ink">
          {problem}
        </p>
      )}
      <div className="flex justify-end gap-inline">
        <Button type="button" variant="ghost" onClick={close}>
          {tOr('ui.cancel', {}, '')}
        </Button>
        <form.Subscribe selector={(state) => state.canSubmit}>
          {(canSubmit) => (
            <Button
              type="submit"
              variant="solid"
              tone="accent"
              loading={save.isPending}
              disabled={!canSubmit}
            >
              {tOr('playlistTools.saveRules', {}, '')}
            </Button>
          )}
        </form.Subscribe>
      </div>
    </form>
  );
}

/** `?modal=playlist-rules`: the owner edits what a smart playlist picks; the page reads it again on save. */
export function RulesDialog({ playlist }: RulesDialogProps) {
  const { tOr } = useT();
  const { isOpen } = useUrlModal('playlist-rules');

  return (
    <UrlModal.Root id="playlist-rules">
      <UrlModal.Content size="lg">
        <UrlModal.Title>{tOr('playlistTools.rulesTitle', {}, '')}</UrlModal.Title>
        <UrlModal.Description>{tOr('playlistTools.rulesDescription', {}, '')}</UrlModal.Description>
        <UrlModal.Body>{isOpen && <RulesForm playlist={playlist} />}</UrlModal.Body>
      </UrlModal.Content>
    </UrlModal.Root>
  );
}
