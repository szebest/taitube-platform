import { useT } from '@vp/intl-react';

import { AppShell } from '#app/components/shell/app-shell';
import { useCommandPaletteStore } from '#app/features/search/command-palette-store';

export function ShellSearch() {
  const { setOpen } = useCommandPaletteStore();
  const { tOr } = useT();

  return (
    <AppShell.SearchTrigger onClick={() => setOpen(true)}>
      {tOr('shell.search', {}, '')}
    </AppShell.SearchTrigger>
  );
}
