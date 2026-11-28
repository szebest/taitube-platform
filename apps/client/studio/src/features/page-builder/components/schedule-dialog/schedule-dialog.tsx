import { Format } from '@kit/intl-react';
import { Button, DateTimePicker, Dialog, Field, SegmentedControl, useToast } from '@kit/ui';
import { useQuery } from '@tanstack/react-query';
import { publishedAt } from '@vp/intl-formats';
import { useApi, useFailureToast } from '@vp/queries';
import { useState } from 'react';
import { pageSchedulesQueryOptions } from '#app/features/page-builder/api/page-queries';
import {
  type PageSchedule,
  useCancelSchedule,
  useSchedulePage,
} from '#app/features/page-builder/hooks/use-page-mutations';
import { useActiveChannel } from '#app/hooks/use-active-channel';
import { useT } from '#app/lib/messages';

const SOURCES = ['draft', 'published'] as const satisfies readonly PageSchedule['source'][];

export interface ScheduleDialogProps {
  onClose: () => void;
  onSchedule: (source: PageSchedule['source'], publishAt: string) => void;
  pending: boolean;
}

const isSource = (value: string): value is PageSchedule['source'] =>
  SOURCES.some((source) => source === value);

function isoOf(local: string): string | null {
  const at = new Date(local);
  return local.length === 16 && !Number.isNaN(at.getTime()) ? at.toISOString() : null;
}

/** Queue the draft to go live, or the page as it is now to come back, at a time of the creator's own clock. */
export function ScheduleDialog({ onClose, onSchedule, pending }: ScheduleDialogProps) {
  const { tOr } = useT();
  const toast = useToast();
  const showFailure = useFailureToast();
  const { channelId } = useActiveChannel();
  const [source, setSource] = useState<PageSchedule['source']>('draft');
  const [local, setLocal] = useState('');
  const schedules = useQuery(pageSchedulesQueryOptions(useApi(), channelId));
  const cancel = useCancelSchedule();
  const at = isoOf(local);
  const waiting = (schedules.data?.items ?? []).filter(({ status }) => status === 'pending');

  return (
    <Dialog.Root open onOpenChange={(open) => !open && onClose()}>
      <Dialog.Content size="md">
        <Dialog.Header>
          <Dialog.Title>{tOr('studio.pageScheduleTitle', {}, '')}</Dialog.Title>
          <Dialog.Description>{tOr('studio.pageScheduleDescription', {}, '')}</Dialog.Description>
        </Dialog.Header>
        <Dialog.Body className="flex flex-col gap-stack">
          <SegmentedControl.Root
            aria-label={tOr('studio.pageScheduleSource', {}, '')}
            value={source}
            onValueChange={(next) => isSource(next) && setSource(next)}
          >
            {SOURCES.map((choice) => (
              <SegmentedControl.Item key={choice} value={choice}>
                {tOr('studio.pageScheduleSourceOption', { source: choice }, '')}
              </SegmentedControl.Item>
            ))}
          </SegmentedControl.Root>
          <Field.Root required>
            <Field.Label>{tOr('studio.pageScheduleAt', {}, '')}</Field.Label>
            <DateTimePicker
              value={local}
              onValueChange={setLocal}
              dateLabel={tOr('studio.composerDate', {}, '')}
              timeLabel={tOr('studio.composerTime', {}, '')}
            />
          </Field.Root>
          {waiting.length > 0 && (
            <ul className="m-0 flex list-none flex-col gap-inline p-0">
              {waiting.map(({ id, publishAt }) => (
                <li key={id} className="flex items-center justify-between gap-inline">
                  <time dateTime={publishAt}>
                    <Format value={publishedAt(publishAt).absolute} />
                  </time>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      cancel.mutate(id, {
                        onSuccess: () =>
                          toast({
                            tone: 'success',
                            title: tOr('studio.pageScheduleCancelled', {}, ''),
                          }),
                        onError: (error) =>
                          showFailure(tOr('studio.pageScheduleCancelFailed', {}, ''), error),
                      })
                    }
                  >
                    {tOr('studio.pageScheduleCancel', {}, '')}
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </Dialog.Body>
        <Dialog.Footer>
          <Dialog.Close asChild>
            <Button variant="outline">{tOr('studio.pageCancel', {}, '')}</Button>
          </Dialog.Close>
          <Button
            variant="solid"
            loading={pending}
            disabled={at === null}
            onClick={() => at !== null && onSchedule(source, at)}
          >
            {tOr('studio.pageScheduleConfirm', {}, '')}
          </Button>
        </Dialog.Footer>
      </Dialog.Content>
    </Dialog.Root>
  );
}
