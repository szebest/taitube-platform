import { useIdentitySwitcher, useLongPress } from '@vp/queries';
import { AppShell } from '#app/components/shell/app-shell';
import { useIsCurrent } from '#app/features/shell/hooks/use-is-current';
import { useShellDestinations } from '#app/hooks/use-shell-destinations';
import { ShellDestinationLink } from '../shell-destination-link/shell-destination-link';

/** The compact tab bar; a long press on the account's You tab opens the switcher's sheet. */
export function ShellTabBar() {
  const { main, hub } = useShellDestinations();
  const isCurrent = useIsCurrent();
  const { show } = useIdentitySwitcher();
  const longPress = useLongPress(() => show('switcher'));

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
            {...(destination === hub ? longPress : {})}
          >
            <ShellDestinationLink destination={destination.target}>
              {destination.label}
            </ShellDestinationLink>
          </AppShell.TabItem>
        ))}
    </AppShell.TabBar>
  );
}
