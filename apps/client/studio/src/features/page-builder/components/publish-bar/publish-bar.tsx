import { Button, Callout, useToast } from '@kit/ui';
import { type ChannelLayout } from '@vp/domain';
import { failureCode, present, useFailureToast } from '@vp/queries';
import { useState } from 'react';
import { VersionConflictDialog } from '#app/components/dialogs/version-conflict-dialog';
import type { DraftEditor } from '#app/features/page-builder/hooks/use-draft-editor';
import {
  usePublishPage,
  useSchedulePage,
} from '#app/features/page-builder/hooks/use-page-mutations';
import type { LayoutProblemTarget } from '#app/features/page-builder/utils/layout-problem';
import { useT } from '#app/lib/messages';
import { RevisionsDrawer } from '../revisions-drawer/revisions-drawer';
import { ScheduleDialog } from '../schedule-dialog/schedule-dialog';
import { TemplateDialog } from '../template-dialog/template-dialog';

type Open = 'schedule' | 'revisions' | 'template';

export interface PublishBarProps {
  editor: DraftEditor;
  onGoTo: (target: LayoutProblemTarget) => void;
  onTemplate: (layout: ChannelLayout) => void;
}

/** Where the draft stands and what to do with it: save it, publish it, queue it, go back to an earlier page, or start from a template. */
export function PublishBar({ editor, onGoTo, onTemplate }: PublishBarProps) {
  const { tOr } = useT();
  const toast = useToast();
  const showFailure = useFailureToast();
  const [open, setOpen] = useState<Open>();
  const publish = usePublishPage();
  const schedule = useSchedulePage();
  const { problem, status } = editor;
  const close = () => setOpen(undefined);
  const refused =
    status === 'failed' ? present({ code: failureCode(editor.failure) }).copy : undefined;

  const publishNow = () =>
    editor.saveThen((version) =>
      publish.mutate(
        { version },
        {
          onSuccess: () => toast({ tone: 'success', title: tOr('studio.pagePublished', {}, '') }),
          onError: (error) => showFailure(tOr('studio.pagePublishFailed', {}, ''), error),
        }
      )
    );

  return (
    <div className="flex flex-col gap-stack">
      <div className="flex flex-wrap items-center gap-inline">
        <p role="status" className="m-0 me-auto text-caption text-fg-muted">
          {tOr('studio.pageStatus', { status }, '')}
        </p>
        <Button variant="outline" onClick={() => setOpen('template')}>
          {tOr('studio.pageTemplates', {}, '')}
        </Button>
        <Button variant="outline" onClick={() => setOpen('revisions')}>
          {tOr('studio.pageHistory', {}, '')}
        </Button>
        <Button variant="outline" disabled={problem !== null} onClick={() => setOpen('schedule')}>
          {tOr('studio.pageSchedule', {}, '')}
        </Button>
        <Button
          variant="outline"
          disabled={problem !== null || status === 'saved' || status === 'saving'}
          onClick={() => editor.saveThen()}
        >
          {tOr('studio.pageSaveDraft', {}, '')}
        </Button>
        <Button
          variant="solid"
          loading={publish.isPending}
          disabled={problem !== null || status === 'conflict'}
          onClick={publishNow}
        >
          {tOr('studio.pagePublish', {}, '')}
        </Button>
      </div>
      {problem && (
        <Callout.Root tone="danger" role="alert">
          <Callout.Icon />
          <Callout.Body>{tOr(present({ code: problem.code }).copy, {}, '')}</Callout.Body>
          {problem.target && (
            <Callout.Action>
              <Button
                variant="outline"
                size="sm"
                onClick={() => problem.target && onGoTo(problem.target)}
              >
                {tOr('studio.pageGoToProblem', {}, '')}
              </Button>
            </Callout.Action>
          )}
        </Callout.Root>
      )}
      {refused && (
        <Callout.Root tone="danger" role="alert">
          <Callout.Icon />
          <Callout.Body>{tOr(refused, {}, '')}</Callout.Body>
        </Callout.Root>
      )}
      <VersionConflictDialog
        open={status === 'conflict'}
        onOpenChange={() => undefined}
        onReload={editor.reload}
        onOverwrite={editor.overwrite}
      />
      {open === 'template' && <TemplateDialog onApply={onTemplate} onClose={close} />}
      {open === 'revisions' && <RevisionsDrawer onClose={close} />}
      {open === 'schedule' && (
        <ScheduleDialog
          onClose={close}
          pending={schedule.isPending}
          onSchedule={(source, publishAt) =>
            editor.saveThen(() =>
              schedule.mutate(
                { source, publishAt },
                {
                  onSuccess: () => {
                    toast({ tone: 'success', title: tOr('studio.pageScheduled', {}, '') });
                    close();
                  },
                  onError: (error) => showFailure(tOr('studio.pageScheduleFailed', {}, ''), error),
                }
              )
            )
          }
        />
      )}
    </div>
  );
}
