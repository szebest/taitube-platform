import { IdentityEntryRow, useIdentityChoices } from '@vp/queries';
import { CommandPalette } from '#app/components/shell/command-palette';
import { useCommandPaletteStore } from '#app/lib/command-palette/command-palette-store';
import { useT } from '#app/lib/messages';

/** The palette's way to switch account or channel: every other identity whose name or handle holds the words. */
export function IdentityPaletteGroup({ words }: { words: string }) {
  const { tOr } = useT();
  const { open, setOpen } = useCommandPaletteStore();
  const { entries, choose } = useIdentityChoices(open);
  const named = words.toLowerCase();
  const matching = entries.filter(
    (entry) =>
      !entry.current &&
      (entry.name.toLowerCase().includes(named) || (entry.handle ?? '').includes(named))
  );

  if (matching.length === 0) return null;

  return (
    <CommandPalette.Group heading={tOr('accounts.switcherTitle', {}, '')}>
      {matching.map((entry) => (
        <CommandPalette.Item
          key={entry.key}
          value={`identity:${entry.key}`}
          onSelect={() => {
            setOpen(false);
            choose(entry);
          }}
        >
          <IdentityEntryRow entry={entry} check={false} />
        </CommandPalette.Item>
      ))}
    </CommandPalette.Group>
  );
}
