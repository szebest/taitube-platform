import { type PropsWithChildren, useState } from 'react';
import { PlayerChannelProvider } from '../../../../apps/client/web/src/lib/player/player-channel';
import type { DevicePreferences } from '../../../../apps/client/web/src/lib/preferences/device-preferences';
import { DevicePreferencesProvider } from '../../../../apps/client/web/src/lib/preferences/device-preferences-provider';
import { PreferencesSyncContext } from '../../../../apps/client/web/src/lib/preferences/preferences-sync.context';

const DEVICE: DevicePreferences = {
  schema: 2,
  playback: {
    quality: 'auto',
    speed: 1,
    autoplayNext: true,
    hoverPreview: true,
    hoverPlay: true,
    captionsOn: false,
    captionsLanguage: null,
    captionsSize: 'medium',
    captionsBackground: 'translucent',
    statsOverlay: false,
  },
  locale: null,
};

/** The web app's own contexts a kit component reads: device preferences, their sync and the player channel. */
export function WebProviders({ children }: PropsWithChildren) {
  const [sync] = useState(() => ({
    signedIn: false,
    save: () => undefined,
    notSaved: new Set<string>(),
  }));

  return (
    <DevicePreferencesProvider initial={DEVICE}>
      <PreferencesSyncContext value={sync}>
        <PlayerChannelProvider>{children}</PlayerChannelProvider>
      </PreferencesSyncContext>
    </DevicePreferencesProvider>
  );
}
