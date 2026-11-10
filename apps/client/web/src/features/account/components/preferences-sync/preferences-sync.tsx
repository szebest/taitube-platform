import { useQuery } from '@tanstack/react-query';
import type { TokenGroup } from '@vp/design-tokens';
import { useT } from '@vp/intl-react';
import { useAccount, useApi } from '@vp/queries';
import {
  type AppearancePreference,
  accountAppearance,
  appearanceFromAccount,
  useAppearance,
  useToast,
} from '@vp/ui';
import { type PropsWithChildren, useEffect, useEffectEvent, useRef, useState } from 'react';
import { appearanceChange } from '#app/features/account/api/appearance-change';
import { noteGuestChange } from '#app/features/account/api/guest-changes';
import type {
  AppliedVersion,
  GuestSections,
  MergeState,
} from '#app/features/account/api/identity-reset';
import { planMerge } from '#app/features/account/api/merge-account';
import type { MergeConflict } from '#app/features/account/api/merge-account';
import { createPatchBatch, type PatchBatch } from '#app/features/account/api/patch-batch';
import { useSavePreferences } from '#app/features/account/hooks/use-save-preferences';
import { AppearanceCrossTab } from '#app/lib/preferences/appearance-cross-tab';
import { useDevicePreferences } from '#app/lib/preferences/device-preferences-provider';
import { clearDirty, markDirty, readDirty } from '#app/lib/preferences/dirty-fields';
import { changedPaths, type PreferencesChange } from '#app/lib/preferences/preferences-change';
import { preferencesQueryOptions } from '#app/lib/preferences/preferences-queries';
import { PreferencesSyncContext } from '#app/lib/preferences/preferences-sync.context';
import { IdentityReset } from '../identity-reset/identity-reset';
import { MergeStateContext } from './merge-state.context';

const SAVE_DELAY_MS = 400;

type Failures = { userId: string | undefined; paths: ReadonlySet<string> };

const NONE: ReadonlySet<string> = new Set();

const fieldName = (path: string): string => {
  const words = (path.split('.').at(-1) ?? path).replace(/([A-Z])/g, ' $1').toLowerCase();
  return words.charAt(0).toUpperCase() + words.slice(1);
};

/** Notes what a signed-out viewer changes, so the sign-in that follows can tell their choices from the defaults. */
function GuestChanges({ baseline }: { baseline: MergeState['baseline'] }) {
  const { preference } = useAppearance();

  const note = useEffectEvent((next: AppearancePreference) => {
    markDirty(noteGuestChange(baseline, next));
  });

  useEffect(() => note(preference), [preference]);

  return null;
}

/**
 * Applies the account's saved preferences over the device's, and the other way for a section it
 * never saved, then sends each later change of the appearance, wherever it was made, to the account.
 */
function AccountMerge({
  userId,
  appliedRef,
  guestRef,
  saving,
  hasWaiting,
  save,
}: {
  userId: string;
  appliedRef: MergeState['applied'];
  guestRef: MergeState['guest'];
  saving: boolean;
  hasWaiting: () => boolean;
  save: (change: PreferencesChange) => void;
}) {
  const api = useApi();
  const { data } = useQuery(preferencesQueryOptions(api));
  const appearance = useAppearance();
  const device = useDevicePreferences();
  const showToast = useToast();
  const { tOr } = useT();
  const synced = useRef(appearance.preference);

  const restore = (conflict: MergeConflict) => {
    const [section, field, group] = conflict.path.split('.');
    if (section === 'playback' && field) {
      device.setPlayback({ [field]: conflict.account });
      save({ playback: { [field]: conflict.account } });
    } else if (field === 'overrides' && group) {
      if (conflict.account === undefined) appearance.resetOverrides(group as TokenGroup);
      else appearance.setOverride(group as TokenGroup, String(conflict.account));
    } else if (field) {
      appearance.update({ [field]: conflict.account });
    }
  };
  const announce = (conflict: MergeConflict) =>
    showToast({
      title: tOr('settings.keptChoice', { field: fieldName(conflict.path) }, ''),
      action: {
        label: tOr('settings.keptChoiceUndo', {}, ''),
        onAction: () => restore(conflict),
      },
    });

  const merge = useEffectEvent((saved: NonNullable<typeof data>, saveInProgress: boolean) => {
    const seen = appliedRef.current;
    if (seen?.userId === userId && seen.version === saved.version) {
      return;
    }
    if (saveInProgress || hasWaiting()) return;

    const guest = guestRef.current ?? {
      appearance: appearance.preference,
      playback: device.preferences.playback,
    };
    guestRef.current = guest;
    const firstMerge = seen?.userId !== userId;
    const from = firstMerge ? guest : undefined;
    if (seen && firstMerge) {
      synced.current = guest.appearance;
      appearance.replace(guest.appearance);
      device.replacePlayback(guest.playback);
    }

    appliedRef.current = { userId, version: saved.version };
    const { toDevice, upload, conflicts } = planMerge(
      saved,
      {
        appearance: accountAppearance(from?.appearance ?? appearance.preference),
        playback: from?.playback ?? device.preferences.playback,
      },
      readDirty(),
      firstMerge
    );
    clearDirty();
    if (toDevice.appearance) {
      synced.current = appearanceFromAccount(toDevice.appearance);
      appearance.replace(synced.current);
    }
    if (toDevice.playback) device.replacePlayback(toDevice.playback);
    if (Object.keys(upload).length > 0) save(upload);
    for (const conflict of conflicts) announce(conflict);
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
  const appliedRef = useRef<AppliedVersion | undefined>(undefined);
  const guestRef = useRef<GuestSections | undefined>(undefined);
  const baselineRef = useRef<AppearancePreference | undefined>(undefined);
  const retryBatchRef = useRef<PatchBatch | null>(null);
  const [failures, setFailures] = useState<Failures>({ userId, paths: NONE });

  const { mutate, isPending } = useSavePreferences({
    onSaved: (view, change) => {
      if (userId) appliedRef.current = { userId, version: view.version };
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
            retryBatchRef.current?.add(change);
            retryBatchRef.current?.flush();
          },
        },
      });
    },
  });
  const batch = createPatchBatch((change) => {
    if (userId) mutate({ change });
  }, SAVE_DELAY_MS);

  useEffect(() => {
    retryBatchRef.current = batch;
    const dropWaiting = () => batch.cancel();
    return dropWaiting;
  }, [batch]);

  const value = {
    signedIn: userId !== undefined,
    save: (change: PreferencesChange) => {
      if (userId) batch.add(change);
      else markDirty(changedPaths(change));
    },
    notSaved: failures.userId === userId ? failures.paths : NONE,
  };
  const mergeState: MergeState = { applied: appliedRef, guest: guestRef, baseline: baselineRef };

  return (
    <PreferencesSyncContext value={value}>
      <MergeStateContext value={mergeState}>
        <IdentityReset userId={userId} />
        <AppearanceCrossTab />
        {userId === undefined && <GuestChanges baseline={baselineRef} />}
        {userId && (
          <AccountMerge
            key={userId}
            userId={userId}
            appliedRef={appliedRef}
            guestRef={guestRef}
            saving={isPending}
            hasWaiting={batch.hasWaiting}
            save={value.save}
          />
        )}
        {children}
      </MergeStateContext>
    </PreferencesSyncContext>
  );
}
