import { useT } from '@vp/intl-react';

import { AppShell } from '#app/components/shell/app-shell';
import {
  ShellDestinationLink,
  useIsCurrent,
  useShellDestinations,
} from '#app/features/shell/shell-destinations';

export function ShellRail() {
  const { main, you } = useShellDestinations();
  const isCurrent = useIsCurrent();
  const { tOr } = useT();

  const renderItem = (destination: (typeof main)[number]) => (
    <AppShell.Item
      key={destination.id}
      asChild
      icon={destination.icon}
      active={isCurrent(destination.target)}
      labelled={!destination.compact}
    >
      <ShellDestinationLink destination={destination.target}>
        {destination.label}
      </ShellDestinationLink>
    </AppShell.Item>
  );

  return (
    <AppShell.Rail>
      <AppShell.Group>{main.map(renderItem)}</AppShell.Group>
      {you.length > 0 && (
        <AppShell.Group heading={tOr('shell.you', {}, '')}>{you.map(renderItem)}</AppShell.Group>
      )}
    </AppShell.Rail>
  );
}
