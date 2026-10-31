import { EmptyState, PageHeader, SectionError } from '@vp/components';
import { useT } from '@vp/intl-react';
import { canManagePick } from '@vp/permissions';
import { useCan } from '@vp/permissions-react';
import { Button, Icon, Skeleton } from '@vp/ui';
import { useState } from 'react';

import type { AdminPick } from '#app/features/admin/api/admin-picks';
import { useAdminPicks } from '#app/features/admin/hooks/use-admin-picks';
import { calendarDays } from '#app/features/admin/lib/pick-days';
import { PickCalendar } from './pick-calendar';
import { PickCancelDialog } from './pick-cancel-dialog';
import { PickDialog } from './pick-dialog';

type Open =
  | { kind: 'create' }
  | { kind: 'edit'; pick: AdminPick }
  | { kind: 'cancel'; pick: AdminPick };

const NONE: readonly AdminPick[] = [];

/** `/admin/curation`: the next 30 days of pick windows, and what an admin may do with them. */
export function CurationPage() {
  const { tOr } = useT();
  const canManage = useCan(canManagePick);
  const picks = useAdminPicks();
  const [open, setOpen] = useState<Open>();
  const [now] = useState(() => new Date());

  const data = picks.data ?? NONE;
  const close = () => setOpen(undefined);
  const create = () => setOpen({ kind: 'create' });

  return (
    <>
      <PageHeader.Root>
        <PageHeader.Title asChild>
          <h1>{tOr('studio.pickTitle', {}, '')}</h1>
        </PageHeader.Title>
        <PageHeader.Description>{tOr('studio.pickIntro', {}, '')}</PageHeader.Description>
        {canManage && (
          <PageHeader.Actions>
            <Button variant="solid" tone="accent" onClick={create}>
              <Icon name="plus" />
              {tOr('studio.pickNew', {}, '')}
            </Button>
          </PageHeader.Actions>
        )}
      </PageHeader.Root>
      {picks.isPending && (
        <div
          aria-hidden="true"
          className="tw:grid tw:grid-cols-2 tw:gap-inline tw:medium:grid-cols-4 tw:expanded:grid-cols-7"
        >
          {calendarDays(now).map((day) => (
            <Skeleton key={day.getTime()} radius="card" className="tw:min-h-[5rem]" />
          ))}
        </div>
      )}
      {picks.isError && (
        <SectionError.Root onRetry={() => picks.refetch()} retrying={picks.isFetching}>
          <SectionError.Message>{tOr('studio.pickCalendarFailed', {}, '')}</SectionError.Message>
        </SectionError.Root>
      )}
      {picks.isSuccess && data.length === 0 && (
        <EmptyState.Root size="section">
          <EmptyState.Title>{tOr('studio.pickEmptyTitle', {}, '')}</EmptyState.Title>
          <EmptyState.Description>
            {tOr('studio.pickEmptyDescription', {}, '')}
          </EmptyState.Description>
          {canManage && (
            <EmptyState.Action onClick={create}>{tOr('studio.pickNew', {}, '')}</EmptyState.Action>
          )}
        </EmptyState.Root>
      )}
      {picks.isSuccess && data.length > 0 && (
        <PickCalendar
          picks={data}
          now={now}
          onEdit={canManage ? (pick) => setOpen({ kind: 'edit', pick }) : undefined}
        />
      )}
      {open?.kind === 'create' && <PickDialog picks={data} onClose={close} />}
      {open?.kind === 'edit' && (
        <PickDialog
          key={open.pick.id}
          pick={open.pick}
          picks={data}
          onClose={close}
          onCancelPick={() => setOpen({ kind: 'cancel', pick: open.pick })}
        />
      )}
      {open?.kind === 'cancel' && <PickCancelDialog pick={open.pick} onClose={close} />}
    </>
  );
}
