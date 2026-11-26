import { AppShell } from '#app/components/shell/app-shell';
import { useCommandPaletteStore } from '#app/lib/command-palette/command-palette-store';
import { useT } from '#app/lib/messages';

export function ShellSearch() {
  const { setOpen } = useCommandPaletteStore();
  const { tOr } = useT();

  return (
    <AppShell.SearchTrigger onClick={() => setOpen(true)}>
      {tOr('shell.search', {}, '')}
    </AppShell.SearchTrigger>
  );
}
