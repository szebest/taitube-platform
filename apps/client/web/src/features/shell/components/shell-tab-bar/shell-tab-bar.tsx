import { AppShell } from '#app/components/shell/app-shell';
import { useIsCurrent } from '#app/features/shell/hooks/use-is-current';
import { useShellDestinations } from '#app/hooks/use-shell-destinations';
import { ShellDestinationLink } from '../shell-destination-link/shell-destination-link';

export function ShellTabBar() {
  const { main, hub } = useShellDestinations();
  const isCurrent = useIsCurrent();

  return (
    <AppShell.TabBar>
      {[...main, ...(hub ? [hub] : [])]
        .filter((destination) => destination.compact)
        .map((destination) => (
          <AppShell.TabItem
            key={destination.id}
            asChild
            icon={destination.icon}
            active={isCurrent(destination.target)}
          >
            <ShellDestinationLink destination={destination.target}>
              {destination.label}
            </ShellDestinationLink>
          </AppShell.TabItem>
        ))}
    </AppShell.TabBar>
  );
}
