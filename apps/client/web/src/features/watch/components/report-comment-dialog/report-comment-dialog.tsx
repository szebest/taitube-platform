import { COMMENT_REPORT_REASONS, type CommentReportReason } from '@vp/domain';
import { useAppForm } from '@vp/forms';
import { useT } from '@vp/intl-react';
import { useFailureToast } from '@vp/queries';
import { isErr } from '@vp/result';
import { Button, ResponsiveModal, useToast, useUiCopy } from '@vp/ui';
import { validateReportNote } from '@vp/validation';
import { useReportComment } from '#app/features/watch/hooks/use-report-comment';

interface ReportCommentFormProps {
  commentId: string;
  onSent: () => void;
}

function ReportCommentForm({ commentId, onSent }: ReportCommentFormProps) {
  const showToast = useToast();
  const showFailure = useFailureToast();
  const { tOr } = useT();
  const { cancel } = useUiCopy();
  const reportComment = useReportComment(commentId);

  const validateNote = ({ value }: { value: string }) =>
    isErr(validateReportNote(value)) ? tOr('watch.reportNoteInvalid', {}, '') : undefined;

  const form = useAppForm({
    defaultValues: { reason: '' as CommentReportReason | '', note: '' },
    onSubmit: ({ value: { reason, note } }) => {
      if (reason === '') {
        return;
      }

      reportComment.mutate(
        { reason, note },
        {
          onSuccess: () => {
            showToast({ tone: 'success', title: tOr('watch.reportSent', {}, '') });
            onSent();
          },
          onError: (error) => showFailure(tOr('watch.reportFailed', {}, ''), error),
        }
      );
    },
  });

  return (
    <form
      className="flex flex-col gap-stack"
      onSubmit={(event) => {
        event.preventDefault();
        void form.handleSubmit();
      }}
    >
      <ResponsiveModal.Body className="flex flex-col gap-stack">
        <form.Field name="reason">
          {(field) => (
            <fieldset className="m-0 flex flex-col gap-inline border-0 p-0">
              <legend className="mb-inline p-0 text-label">
                {tOr('watch.reportReasonLabel', {}, '')}
              </legend>
              {COMMENT_REPORT_REASONS.map((reason) => (
                <label key={reason} className="flex items-center gap-inline text-body">
                  <input
                    type="radio"
                    name={field.name}
                    value={reason}
                    required
                    checked={field.state.value === reason}
                    onChange={() => field.handleChange(reason)}
                    onBlur={field.handleBlur}
                  />
                  {tOr('watch.reportReason', { reason }, '')}
                </label>
              ))}
            </fieldset>
          )}
        </form.Field>
        <form.AppField name="note" validators={{ onChange: validateNote }}>
          {(field) => <field.TextField label={tOr('watch.reportNoteLabel', {}, '')} multiline />}
        </form.AppField>
      </ResponsiveModal.Body>
      <ResponsiveModal.Footer>
        <ResponsiveModal.Close asChild>
          <Button variant="ghost">{cancel}</Button>
        </ResponsiveModal.Close>
        <form.Subscribe selector={(state) => state.canSubmit && state.values.reason !== ''}>
          {(canSubmit) => (
            <Button
              type="submit"
              variant="solid"
              tone="danger"
              loading={reportComment.isPending}
              disabled={!canSubmit}
            >
              {tOr('watch.reportSubmit', {}, '')}
            </Button>
          )}
        </form.Subscribe>
      </ResponsiveModal.Footer>
    </form>
  );
}

export interface ReportCommentDialogProps {
  commentId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/** Reports a comment to the moderators: a reason from the list and an optional note. */
export function ReportCommentDialog({ commentId, open, onOpenChange }: ReportCommentDialogProps) {
  const { tOr } = useT();

  return (
    <ResponsiveModal.Root open={open} onOpenChange={onOpenChange}>
      <ResponsiveModal.Content>
        <ResponsiveModal.Title>{tOr('watch.reportTitle', {}, '')}</ResponsiveModal.Title>
        <ResponsiveModal.Description>
          {tOr('watch.reportDescription', {}, '')}
        </ResponsiveModal.Description>
        <ReportCommentForm commentId={commentId} onSent={() => onOpenChange(false)} />
      </ResponsiveModal.Content>
    </ResponsiveModal.Root>
  );
}
