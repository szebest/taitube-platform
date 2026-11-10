import { useT } from '@vp/intl-react';
import { Button, DropdownMenu, Icon } from '@vp/ui';
import type { PartyRoomLayout } from '#app/components/party/party-room';

const LAYOUTS = [
  { value: 'side', label: 'party.layoutSide' },
  { value: 'below', label: 'party.layoutBelow' },
  { value: 'theater', label: 'party.layoutTheater' },
  { value: 'focus', label: 'party.layoutFocus' },
] as const satisfies readonly { value: PartyRoomLayout; label: string }[];

interface PartyLayoutMenuProps {
  layout: PartyRoomLayout;
  onLayoutChange: (layout: PartyRoomLayout) => void;
}

function isLayout(value: string): value is PartyRoomLayout {
  return LAYOUTS.some((option) => option.value === value);
}

/** The viewer's pick of where the panel sits, or whether it shows at all. */
export function PartyLayoutMenu({ layout, onLayoutChange }: PartyLayoutMenuProps) {
  const { tOr } = useT();

  const handleChange = (value: string) => {
    if (isLayout(value)) {
      onLayoutChange(value);
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
        <DropdownMenu.RadioGroup value={layout} onValueChange={handleChange}>
          {LAYOUTS.map(({ value, label }) => (
            <DropdownMenu.RadioItem key={value} value={value}>
              {tOr(label, {}, '')}
            </DropdownMenu.RadioItem>
          ))}
        </DropdownMenu.RadioGroup>
      </DropdownMenu.Content>
    </DropdownMenu.Root>
  );
}
