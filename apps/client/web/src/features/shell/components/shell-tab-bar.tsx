import { AppShell } from '#app/components/shell/app-shell';
import {
  ShellDestinationLink,
  useIsCurrent,
  useShellDestinations,
} from '#app/features/shell/shell-destinations';

export function ShellTabBar() {
  const { main, you } = useShellDestinations();
  const isCurrent = useIsCurrent();

  return (
    <AppShell.TabBar>
      {[...main, ...you]
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
