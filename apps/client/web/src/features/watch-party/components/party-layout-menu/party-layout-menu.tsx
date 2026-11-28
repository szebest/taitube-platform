import { Button, DropdownMenu, Icon } from '@kit/ui';
import type { PartyPreferences } from '@vp/domain/settings';
import type { PartyRoomLayout } from '#app/components/party/party-room';
import { useT } from '#app/lib/messages';

const LAYOUTS = [
  { value: 'side', label: 'party.layoutSide' },
  { value: 'below', label: 'party.layoutBelow' },
  { value: 'theater', label: 'party.layoutTheater' },
  { value: 'focus', label: 'party.layoutFocus' },
] as const satisfies readonly { value: PartyRoomLayout; label: string }[];

type PartyViewOptions = Pick<PartyPreferences, 'layout' | 'reactionOverlay' | 'systemLines'>;

interface PartyLayoutMenuProps {
  preferences: PartyViewOptions;
  onChange: (patch: Partial<PartyViewOptions>) => void;
}

function isLayout(value: string): value is PartyRoomLayout {
  return LAYOUTS.some((option) => option.value === value);
}

/** The viewer's pick of where the panel sits, or whether it shows at all. */
export function PartyLayoutMenu({ preferences, onChange }: PartyLayoutMenuProps) {
  const { tOr } = useT();

  const handleChange = (value: string) => {
    if (isLayout(value)) {
      onChange({ layout: value });
    }
  };

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <Button size="sm" variant="ghost">
          <Icon name="layout" size="sm" />
          {tOr('party.roomLayout', {}, '')}
        </Button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Content>
        <DropdownMenu.RadioGroup value={preferences.layout} onValueChange={handleChange}>
          {LAYOUTS.map(({ value, label }) => (
            <DropdownMenu.RadioItem key={value} value={value}>
              {tOr(label, {}, '')}
            </DropdownMenu.RadioItem>
          ))}
        </DropdownMenu.RadioGroup>
        <DropdownMenu.Separator />
        <DropdownMenu.CheckboxItem
          checked={preferences.reactionOverlay}
          onCheckedChange={(reactionOverlay) => onChange({ reactionOverlay })}
        >
          {tOr('party.layoutReactions', {}, '')}
        </DropdownMenu.CheckboxItem>
        <DropdownMenu.CheckboxItem
          checked={preferences.systemLines}
          onCheckedChange={(systemLines) => onChange({ systemLines })}
        >
          {tOr('party.layoutSystemLines', {}, '')}
        </DropdownMenu.CheckboxItem>
      </DropdownMenu.Content>
    </DropdownMenu.Root>
  );
}
