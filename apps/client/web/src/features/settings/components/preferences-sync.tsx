import { useQuery } from '@tanstack/react-query';
import type { PlaybackPreferences } from '@vp/domain/settings';
import { useT } from '@vp/intl-react';
import { useAccount, useApi } from '@vp/queries';
import { accountAppearance, appearanceFromAccount, useAppearance, useToast } from '@vp/ui';
import {
  type PropsWithChildren,
  useEffect,
  useEffectEvent,
  useMemo,
  useRef,
  useState,
} from 'react';

import { appearanceChange } from '../api/appearance-change';
import { planMerge } from '../api/merge-account';
import { createPatchBatch } from '../api/patch-batch';
import { changedPaths, type PreferencesChange } from '../api/preferences-change';
import { preferencesQueryOptions } from '../api/preferences-queries';
import { useDevicePreferences } from '../device/device-preferences-provider';
import { useSavePreferences } from '../hooks/use-save-preferences';
import { PreferencesSyncContext } from './preferences-sync.context';

const SAVE_DELAY_MS = 400;

type AppliedVersion = { userId: string; version: number };

type GuestSections = {
  appearance: ReturnType<typeof useAppearance>['preference'];
  playback: PlaybackPreferences;
};

type Failures = { userId: string | undefined; paths: ReadonlySet<string> };

const NONE: ReadonlySet<string> = new Set();

/**
 * Applies the account's saved preferences over the device's, and the other way for a section it
 * never saved, then sends each later change of the appearance, wherever it was made, to the account.
 */
function AccountMerge({
  userId,
  applied,
  guest,
  saving,
  hasWaiting,
  save,
}: {
  userId: string;
  applied: { current: AppliedVersion | undefined };
  guest: { current: GuestSections | undefined };
  saving: boolean;
  hasWaiting: () => boolean;
  save: (change: PreferencesChange) => void;
}) {
  const api = useApi();
  const { data } = useQuery(preferencesQueryOptions(api));
  const appearance = useAppearance();
  const device = useDevicePreferences();
  const synced = useRef(appearance.preference);

  const merge = useEffectEvent((saved: NonNullable<typeof data>, saveInProgress: boolean) => {
    const seen = applied.current;
    if (seen?.userId === userId && seen.version === saved.version) {
      return;
    }
    if (saveInProgress || hasWaiting()) return;

    guest.current ??= { appearance: appearance.preference, playback: device.preferences.playback };
    const firstMerge = seen?.userId !== userId;
    const from = firstMerge ? guest.current : undefined;
    if (seen && firstMerge) {
      synced.current = guest.current.appearance;
      appearance.replace(guest.current.appearance);
      device.replacePlayback(guest.current.playback);
    }

    applied.current = { userId, version: saved.version };
    const { toDevice, upload } = planMerge(
      saved,
      {
        appearance: accountAppearance(from?.appearance ?? appearance.preference),
        playback: from?.playback ?? device.preferences.playback,
      },
      firstMerge
    );
    if (toDevice.appearance) {
      synced.current = appearanceFromAccount(toDevice.appearance);
      appearance.replace(synced.current);
    }
    if (toDevice.playback) device.replacePlayback(toDevice.playback);
    if (Object.keys(upload).length > 0) save(upload);
  });

  const saveAppearance = useEffectEvent((preference: typeof appearance.preference) => {
    const change = appearanceChange(synced.current, preference);
    synced.current = preference;
    if (change) save(change);
  });

  useEffect(() => {
    if (data) merge(data, saving);
  }, [data, saving]);

  useEffect(() => {
    saveAppearance(appearance.preference);
  }, [appearance.preference]);

  return null;
}

/**
 * Saves a signed-in viewer's changes to their account, debounced and optimistic, and merges the
 * account's preferences into the device's on sign-in and whenever another device saves.
 */
export function PreferencesSync({ children }: PropsWithChildren) {
  const userId = useAccount()?.user.id;
  const showToast = useToast();
  const { tOr } = useT();
  const applied = useRef<AppliedVersion | undefined>(undefined);
  const guest = useRef<GuestSections | undefined>(undefined);
  const [failures, setFailures] = useState<Failures>({ userId, paths: NONE });

  const { mutate, isPending } = useSavePreferences({
    onSaved: (view, change) => {
      if (userId) applied.current = { userId, version: view.version };
      setFailures((current) => ({
        userId,
        paths: new Set([...current.paths].filter((path) => !changedPaths(change).includes(path))),
      }));
    },
    onFailed: (change) => {
      setFailures((current) => ({
        userId,
        paths: new Set([
          ...(current.userId === userId ? current.paths : NONE),
          ...changedPaths(change),
        ]),
      }));
      showToast({
        tone: 'danger',
        title: tOr('settings.saveFailed', {}, ''),
        description: tOr('settings.saveFailedDescription', {}, ''),
        action: {
          label: tOr('settings.retry', {}, ''),
          onAction: () => {
            batch.add(change);
            batch.flush();
          },
        },
      });
    },
  });
  const batch = useMemo(
    () =>
      createPatchBatch((change) => {
        if (userId) mutate({ change });
      }, SAVE_DELAY_MS),
    [mutate, userId]
  );

  useEffect(() => {
    const dropWaiting = () => batch.cancel();
    return dropWaiting;
  }, [batch]);

  const value = useMemo(
    () => ({
      signedIn: userId !== undefined,
      save: (change: PreferencesChange) => {
        if (userId) batch.add(change);
      },
      notSaved: failures.userId === userId ? failures.paths : NONE,
    }),
    [userId, batch, failures]
  );

  return (
    <PreferencesSyncContext value={value}>
      {userId && (
        <AccountMerge
          key={userId}
          userId={userId}
          applied={applied}
          guest={guest}
          saving={isPending}
          hasWaiting={batch.hasWaiting}
          save={value.save}
        />
      )}
      {children}
    </PreferencesSyncContext>
  );
}
