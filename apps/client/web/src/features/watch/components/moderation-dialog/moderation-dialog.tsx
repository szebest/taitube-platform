import { useQuery } from '@tanstack/react-query';
import type { CommentView } from '@vp/api-contracts';
import { DisclosureControl } from '@vp/components';
import {
  COMMENT_MODERATION_REASONS,
  type CommentModerationReason,
  DEFAULT_DISCLOSURE,
  type Disclosure,
  type DisclosureRule,
} from '@vp/domain';
import { useAppForm, validateWith } from '@vp/forms';
import { useT } from '@vp/intl-react';
import { canReadCommentSettings } from '@vp/permissions';
import { useCan } from '@vp/permissions-react';
import {
  commentSettingsQueryOptions,
  useApi,
  useFailureToast,
  useModerateComment,
  useRestrictUser,
} from '@vp/queries';
import { Button, ResponsiveModal, useToast, useUiCopy } from '@vp/ui';
import { validateModerationNote } from '@vp/validation';
import { useId } from 'react';
import { BAN_DURATIONS, type BanDuration, banExpiry } from '#app/features/watch/utils/ban-duration';

export type ModerationDialogAction = 'hold' | 'hide' | 'remove' | 'shadow_ban' | 'ban';

const RULE_OF: Record<
  Extract<ModerationDialogAction, 'hold' | 'hide' | 'remove'>,
  DisclosureRule
> = { hold: 'manual_hold', hide: 'hide', remove: 'remove' };

export interface ModerationDialogProps {
  comment: CommentView;
  action: ModerationDialogAction;
  channel: { channelId: string; ownerId: string };
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface FormProps extends Omit<ModerationDialogProps, 'open' | 'channel'> {
  channelId: string;
  preset: Disclosure;
}

function ModerationForm({ comment, action, channelId, preset, onOpenChange }: FormProps) {
  const { tOr } = useT();
  const { cancel } = useUiCopy();
  const showToast = useToast();
  const showFailure = useFailureToast();
  const moderate = useModerateComment();
  const restrict = useRestrictUser();
  const disclosureNote = useId();
  const onComment = action === 'hold' || action === 'hide' || action === 'remove';

  const validateNote = validateWith(validateModerationNote);

  const form = useAppForm({
    defaultValues: {
      disclosure: preset,
      reason: 'spam' as CommentModerationReason,
      note: '',
      duration: '7d' as BanDuration,
    },
    onSubmit: ({ value: { disclosure, reason, note, duration } }) => {
      const done = () => {
        showToast({ tone: 'success', title: tOr('watch.moderationDone', { action }, '') });
        onOpenChange(false);
      };
      const failed = (error: unknown) => showFailure(tOr('watch.moderationFailed', {}, ''), error);
      const detail = note.trim() || undefined;

      if (onComment) {
        moderate.mutate(
          { commentId: comment.id, action: { action, disclosure, reason, note: detail } },
          { onSuccess: done, onError: failed }
        );
        return;
      }

      restrict.mutate(
        {
          channelId,
          userId: comment.author.userId,
          action:
            action === 'ban'
              ? {
                  action,
                  reason: detail ?? tOr('watch.moderationReason', { reason }, ''),
                  expiresAt: banExpiry(duration, new Date()),
                }
              : { action },
        },
        { onSuccess: done, onError: failed }
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
        {onComment && (
          <form.Field name="disclosure">
            {(field) => (
              <div className="flex flex-col gap-inline">
                <DisclosureControl
                  value={field.state.value}
                  onValueChange={field.handleChange}
                  aria-describedby={disclosureNote}
                />
                <p id={disclosureNote} className="m-0 text-caption text-fg-muted">
                  {field.state.value === 'silent'
                    ? tOr('watch.moderationDisclosureSilent', {}, '')
                    : tOr('watch.moderationDisclosureVisible', {}, '')}
                </p>
              </div>
            )}
          </form.Field>
        )}
        {action !== 'shadow_ban' && (
          <form.AppField name="reason">
            {(field) => (
              <field.SelectField
                label={tOr('watch.moderationReasonLabel', {}, '')}
                options={COMMENT_MODERATION_REASONS}
                labelOf={(reason) => tOr('watch.moderationReason', { reason }, '')}
              />
            )}
          </form.AppField>
        )}
        {action === 'ban' && (
          <form.AppField name="duration">
            {(field) => (
              <field.SelectField
                label={tOr('watch.moderationDurationLabel', {}, '')}
                options={BAN_DURATIONS}
                labelOf={(duration) => tOr('watch.moderationDuration', { duration }, '')}
              />
            )}
          </form.AppField>
        )}
        {action !== 'shadow_ban' && (
          <form.AppField name="note" validators={{ onChange: validateNote }}>
            {(field) => (
              <field.TextField label={tOr('watch.moderationNoteLabel', {}, '')} multiline />
            )}
          </form.AppField>
        )}
      </ResponsiveModal.Body>
      <ResponsiveModal.Footer>
        <ResponsiveModal.Close asChild>
          <Button variant="ghost">{cancel}</Button>
        </ResponsiveModal.Close>
        <form.Subscribe
          selector={({ canSubmit, values }) =>
            canSubmit &&
            !(onComment && values.disclosure === 'visible' && values.note.trim() === '')
          }
        >
          {(canSubmit) => (
            <Button
              type="submit"
              variant="solid"
              tone="danger"
              loading={moderate.isPending || restrict.isPending}
              disabled={!canSubmit}
            >
              {tOr('watch.moderationSubmit', { action }, '')}
            </Button>
          )}
        </form.Subscribe>
      </ResponsiveModal.Footer>
    </form>
  );
}

/** Asks for what a hold, hide, remove, shadow ban or ban needs: who is told, why, a note, and for a ban how long. */
export function ModerationDialog({
  comment,
  action,
  channel,
  open,
  onOpenChange,
}: ModerationDialogProps) {
  const api = useApi();
  const { tOr } = useT();
  const canRead = useCan(canReadCommentSettings, { channel });
  const rule =
    action === 'hold' || action === 'hide' || action === 'remove' ? RULE_OF[action] : null;
  const asksSettings = canRead && rule !== null;
  const settings = useQuery({
    ...commentSettingsQueryOptions(api, channel.channelId),
    enabled: asksSettings,
  });
  const preset = rule ? (settings.data?.disclosure[rule] ?? DEFAULT_DISCLOSURE[rule]) : 'silent';
  const settled = !asksSettings || !settings.isPending;

  return (
    <ResponsiveModal.Root open={open} onOpenChange={onOpenChange}>
      <ResponsiveModal.Content>
        <ResponsiveModal.Title>
          {tOr('watch.moderationTitle', { action }, '')}
        </ResponsiveModal.Title>
        <ResponsiveModal.Description>
          {tOr('watch.moderationDescription', { action }, '')}
        </ResponsiveModal.Description>
        {settled && (
          <ModerationForm
            comment={comment}
            action={action}
            channelId={channel.channelId}
            preset={preset}
            onOpenChange={onOpenChange}
          />
        )}
      </ResponsiveModal.Content>
    </ResponsiveModal.Root>
  );
}
