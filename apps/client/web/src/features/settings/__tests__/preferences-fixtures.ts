import { getPreferences, type PreferencesView, updatePreferences } from '@vp/api-contracts';
import { DEFAULT_PREFERENCES } from '@vp/domain/settings';
import { mockEndpoint } from '@vp/web-testing';
import { HttpResponse } from 'msw/http';

import type { PreferencesChange } from '../api/preferences-change';

export const preferencesView = (overrides: Partial<PreferencesView> = {}): PreferencesView => ({
  appearance: null,
  playback: null,
  privacy: null,
  notifications: null,
  version: 0,
  updatedAt: null,
  ...overrides,
});

export const SAVED_PLAYBACK = { ...DEFAULT_PREFERENCES.playback, autoplayNext: false };

export const holds = (view: PreferencesView) =>
  mockEndpoint(getPreferences, () => HttpResponse.json(view));

export type SentSave = PreferencesChange & { version: number };

/** Answers each save with the document the account then holds, and keeps what was sent. */
export function acceptsSaves(sent: SentSave[], after: (body: SentSave) => PreferencesView) {
  return mockEndpoint(updatePreferences, async ({ request }) => {
    const body = (await request.json()) as SentSave;
    sent.push(body);
    return HttpResponse.json(after(body));
  });
}
