import {
  ANALYTICS_RANGES,
  type AnalyticsRange,
  analyticsPeriods,
  DATA_EXPORT_FORMATS,
  DATA_EXPORT_LIMITS,
  type DataExportFormat,
  type DataExportKind,
} from '@vp/domain';
import { useT } from '@vp/intl-react';
import { useFailureToast } from '@vp/queries';
import { fromPromise, isOk } from '@vp/result';
import {
  Button,
  Field,
  ResponsiveModal,
  SegmentedControl,
  Select,
  useToast,
  useUiCopy,
} from '@vp/ui';
import { type FormEvent, useState } from 'react';
import { useRequestExport } from '#app/features/developers/hooks/use-developer-mutations';

/** Lifetime is no range at all, so the file reaches the oldest data there is. */
function paramsOf(range: AnalyticsRange, today: Date) {
  return range === 'lifetime' ? {} : analyticsPeriods(range, today).current;
}

export interface RequestExportDialogProps {
  kinds: readonly DataExportKind[];
  onClose: () => void;
}

/** Which data, in which format, over which days; the job runs and the table follows it. */
export function RequestExportDialog({ kinds, onClose }: RequestExportDialogProps) {
  const { tOr } = useT();
  const { cancel } = useUiCopy();
  const toast = useToast();
  const showFailure = useFailureToast();
  const request = useRequestExport();
  const [kind, setKind] = useState<DataExportKind | undefined>(kinds[0]);
  const [format, setFormat] = useState<DataExportFormat>('csv');
  const [range, setRange] = useState<AnalyticsRange>('lifetime');

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!kind) return;

    const asked = await fromPromise(
      () => request.mutateAsync({ kind, format, params: paramsOf(range, new Date()) }),
      (cause) => cause
    );
    if (isOk(asked)) {
      toast({ tone: 'success', title: tOr('studio.exportRequested', {}, '') });
      onClose();
      return;
    }
    showFailure(tOr('studio.exportRequestFailed', {}, ''), asked.error);
  };

  return (
    <ResponsiveModal.Root open onOpenChange={(open) => !open && onClose()}>
      <ResponsiveModal.Content size="sm">
        <form onSubmit={submit}>
          <ResponsiveModal.Header>
            <ResponsiveModal.Title>{tOr('studio.exportDialogTitle', {}, '')}</ResponsiveModal.Title>
            <ResponsiveModal.Description>
              {tOr('studio.exportDialogDescription', { perDay: DATA_EXPORT_LIMITS.perDay }, '')}
            </ResponsiveModal.Description>
          </ResponsiveModal.Header>
          <ResponsiveModal.Body className="flex flex-col gap-stack">
            <Field.Root>
              <Field.Label>{tOr('studio.exportKindLabel', {}, '')}</Field.Label>
              <Select.Root
                value={kind}
                onValueChange={(next) => setKind(kinds.find((option) => option === next))}
              >
                <Select.Trigger>
                  <Select.Value />
                </Select.Trigger>
                <Select.Content>
                  {kinds.map((option) => (
                    <Select.Item key={option} value={option}>
                      {tOr('studio.exportKind', { kind: option }, option)}
                    </Select.Item>
                  ))}
                </Select.Content>
              </Select.Root>
            </Field.Root>
            <Field.Root>
              <span className="text-label">{tOr('studio.exportFormatLabel', {}, '')}</span>
              <SegmentedControl.Root
                aria-label={tOr('studio.exportFormatLabel', {}, '')}
                value={format}
                onValueChange={(next) => {
                  const known = DATA_EXPORT_FORMATS.find((option) => option === next);
                  if (known) setFormat(known);
                }}
              >
                {DATA_EXPORT_FORMATS.map((option) => (
                  <SegmentedControl.Item key={option} value={option}>
                    {tOr('studio.exportFormat', { format: option }, option)}
                  </SegmentedControl.Item>
                ))}
              </SegmentedControl.Root>
            </Field.Root>
            <Field.Root>
              <Field.Label>{tOr('studio.exportRangeLabel', {}, '')}</Field.Label>
              <Select.Root
                value={range}
                onValueChange={(next) => {
                  const known = ANALYTICS_RANGES.find((option) => option === next);
                  if (known) setRange(known);
                }}
              >
                <Select.Trigger>
                  <Select.Value />
                </Select.Trigger>
                <Select.Content>
                  {ANALYTICS_RANGES.map((option) => (
                    <Select.Item key={option} value={option}>
                      {tOr('studio.exportRangeOption', { range: option }, option)}
                    </Select.Item>
                  ))}
                </Select.Content>
              </Select.Root>
            </Field.Root>
          </ResponsiveModal.Body>
          <ResponsiveModal.Footer>
            <Button variant="outline" type="button" onClick={onClose}>
              {cancel}
            </Button>
            <Button
              variant="solid"
              tone="accent"
              type="submit"
              disabled={!kind}
              loading={request.isPending}
            >
              {tOr('studio.exportRequestSubmit', {}, '')}
            </Button>
          </ResponsiveModal.Footer>
        </form>
      </ResponsiveModal.Content>
    </ResponsiveModal.Root>
  );
}
