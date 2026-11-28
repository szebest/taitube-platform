import { DropdownMenu } from '@kit/ui';
import type { PersonalControlValues } from '@vp/domain';
import { useT } from '#app/lib/messages';
import { CONTROL_FLAGS } from './constants';
import type { MemberControlScope } from './types';

export interface MemberPersonalControlsProps {
  /** What the viewer chose about this member in this room. */
  room: PersonalControlValues;
  /** What they chose everywhere. */
  everywhere: PersonalControlValues;
  /** A guest has no account to hold an everywhere choice. */
  everywhereAllowed: boolean;
  onChange: (scope: MemberControlScope, patch: Partial<PersonalControlValues>) => void;
}

function ScopeSub({
  scope,
  label,
  values,
  disabled = false,
  onChange,
}: {
  scope: MemberControlScope;
  label: string;
  values: PersonalControlValues;
  disabled?: boolean;
  onChange: MemberPersonalControlsProps['onChange'];
}) {
  const { tOr } = useT();

  return (
    <DropdownMenu.Sub>
      <DropdownMenu.SubTrigger disabled={disabled}>{label}</DropdownMenu.SubTrigger>
      <DropdownMenu.SubContent>
        {CONTROL_FLAGS.filter(({ scope: only }) => only === 'both' || only === scope).map(
          ({ flag, label: flagLabel }) => (
            <DropdownMenu.CheckboxItem
              key={flag}
              checked={values[flag]}
              onCheckedChange={(checked) => onChange(scope, { [flag]: checked })}
            >
              {tOr(flagLabel, {}, '')}
            </DropdownMenu.CheckboxItem>
          )
        )}
      </DropdownMenu.SubContent>
    </DropdownMenu.Sub>
  );
}

/** The viewer's own controls over one member, for `MemberMenu`'s `personalControls`: this room, or everywhere. */
export function MemberPersonalControls({
  room,
  everywhere,
  everywhereAllowed,
  onChange,
}: MemberPersonalControlsProps) {
  const { tOr } = useT();

  return (
    <>
      <ScopeSub
        scope="room"
        label={tOr('party.controlScopeRoom', {}, '')}
        values={room}
        onChange={onChange}
      />
      <ScopeSub
        scope="everywhere"
        label={tOr(
          everywhereAllowed ? 'party.controlScopeEverywhere' : 'party.controlScopeEverywhereGuest',
          {},
          ''
        )}
        values={everywhere}
        disabled={!everywhereAllowed}
        onChange={onChange}
      />
    </>
  );
}
