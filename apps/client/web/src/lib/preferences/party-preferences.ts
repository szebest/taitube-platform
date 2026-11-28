import { isOk, parseJson } from '@kit/result';
import { ONE_YEAR_S, readCookie, writeCookie } from '@kit/ui';
import { PARTY_ROOM_LAYOUTS } from '@vp/domain';
import { PARTY_SETTINGS, type PartyPreferences, sectionDefaults } from '@vp/domain/settings';
import { z } from 'zod';

const PARTY_COOKIE = 'vp.party';

export const DEFAULT_PARTY_PREFERENCES: PartyPreferences = sectionDefaults(PARTY_SETTINGS);

const PartyCookieSchema = z.object({
  layout: z.literal(PARTY_ROOM_LAYOUTS).catch(DEFAULT_PARTY_PREFERENCES.layout),
  chatOverlay: z.boolean().catch(DEFAULT_PARTY_PREFERENCES.chatOverlay),
  reactionOverlay: z.boolean().catch(DEFAULT_PARTY_PREFERENCES.reactionOverlay),
  systemLines: z.boolean().catch(DEFAULT_PARTY_PREFERENCES.systemLines),
});

/**
 * The party view settings this device holds, from the cookie the server reads too, so the first
 * paint is already in the viewer's layout. `null` when the device has chosen nothing.
 */
export function readPartyPreferences(): PartyPreferences | null {
  const raw = readCookie(PARTY_COOKIE);
  const json = raw === undefined ? undefined : parseJson(raw);
  if (!json || !isOk(json)) {
    return null;
  }

  return PartyCookieSchema.parse(json.value);
}

export function writePartyPreferences(preferences: PartyPreferences): void {
  writeCookie(PARTY_COOKIE, JSON.stringify(preferences), { maxAge: ONE_YEAR_S });
}

export const partyCookieName = PARTY_COOKIE;
