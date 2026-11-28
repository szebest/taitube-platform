import { Avatar, Button, Input } from '@kit/ui';
import type { ContractResult, listWatchPartyInviteCandidates } from '@vp/api-contracts';
import { useT } from '#app/lib/messages';

/** @internal */
export type InviteCandidate = ContractResult<
  typeof listWatchPartyInviteCandidates
>['items'][number];

export interface InvitePickerProps {
  query: string;
  onQueryChange: (query: string) => void;
  candidates: readonly InviteCandidate[];
  /** The people an invite is on its way to. */
  sending: ReadonlySet<string>;
  onInvite: (userId: string) => void;
}

function CandidateAction({
  candidate,
  sending,
  onInvite,
}: {
  candidate: InviteCandidate;
  sending: boolean;
  onInvite: () => void;
}) {
  const { tOr } = useT();

  if (candidate.inRoom) {
    return <span className="text-body-sm text-fg-muted">{tOr('party.shareInRoom', {}, '')}</span>;
  }
  if (candidate.invited) {
    return <span className="text-body-sm text-fg-muted">{tOr('party.shareInvited', {}, '')}</span>;
  }
  return (
    <Button size="sm" variant="outline" disabled={sending} onClick={onInvite}>
      {tOr('party.shareInviteAction', {}, '')}
    </Button>
  );
}

/** Who to invite: a search over the room's suggestions, and an Invite button on each person not yet in or invited. */
export function InvitePicker({
  query,
  onQueryChange,
  candidates,
  sending,
  onInvite,
}: InvitePickerProps) {
  const { tOr } = useT();

  return (
    <div className="flex min-w-0 flex-col gap-inline">
      <Input
        type="search"
        aria-label={tOr('party.shareInviteSearch', {}, '')}
        placeholder={tOr('party.shareInviteSearch', {}, '')}
        value={query}
        onChange={(event) => onQueryChange(event.target.value)}
      />
      {candidates.length === 0 ? (
        <p className="m-0 text-body-sm text-fg-muted">{tOr('party.shareInviteEmpty', {}, '')}</p>
      ) : (
        <ul className="m-0 flex max-h-56 list-none flex-col gap-inline overflow-y-auto p-0">
          {candidates.map((candidate) => {
            const name = candidate.displayName ?? candidate.handle ?? '';
            return (
              <li key={candidate.userId} className="flex min-w-0 items-center gap-stack">
                <Avatar.Root size="sm" aria-hidden="true">
                  {candidate.avatarUrl && <Avatar.Image src={candidate.avatarUrl} alt="" />}
                  <Avatar.Fallback>{name.slice(0, 1)}</Avatar.Fallback>
                </Avatar.Root>
                <span className="min-w-0 flex-1 truncate text-body">{name}</span>
                <CandidateAction
                  candidate={candidate}
                  sending={sending.has(candidate.userId)}
                  onInvite={() => onInvite(candidate.userId)}
                />
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
