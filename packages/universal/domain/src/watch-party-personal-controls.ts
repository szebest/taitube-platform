const PERSONAL_CONTROL_FLAGS = [
  'voiceMuted',
  'hideMessages',
  'hideReactions',
  'hideAvatar',
  'hideRequests',
  'blockInvites',
  'favourite',
] as const;
type PersonalControlFlag = (typeof PERSONAL_CONTROL_FLAGS)[number];

export const PERSONAL_VOLUME = { min: 0, max: 200, default: 100 } as const;

export type PersonalControlValues = Readonly<Record<PersonalControlFlag, boolean>> & {
  readonly volume: number;
};

/** What one viewer chose about one member, in one room (`roomId`) or everywhere (`null`). */
export interface PersonalControl extends PersonalControlValues {
  readonly targetKey: string;
  readonly roomId: string | null;
}

export const NO_PERSONAL_CONTROL: PersonalControlValues = {
  voiceMuted: false,
  hideMessages: false,
  hideReactions: false,
  hideAvatar: false,
  hideRequests: false,
  blockInvites: false,
  favourite: false,
  volume: PERSONAL_VOLUME.default,
};

/** A row that chooses nothing is deleted rather than stored. */
export function isNoPersonalControl(values: PersonalControlValues): boolean {
  return (
    PERSONAL_CONTROL_FLAGS.every((flag) => !values[flag]) &&
    values.volume === PERSONAL_VOLUME.default
  );
}

/** The controls that apply in `roomId`: that room's and the everywhere ones. */
/** @internal */
export function controlsForRoom(
  controls: readonly PersonalControl[],
  roomId: string
): PersonalControl[] {
  return controls.filter((control) => control.roomId === null || control.roomId === roomId);
}

/**
 * @internal
 * One target's controls in a room: a flag holds when either scope sets it, and the room's volume
 * wins over the everywhere one when it sets one. Blocking invites is an everywhere control only.
 */
export function resolvePersonalControl(
  controls: readonly PersonalControl[],
  targetKey: string,
  roomId: string | null
): PersonalControlValues {
  const everywhere = controls.find((c) => c.targetKey === targetKey && c.roomId === null);
  const inRoom = controls.find(
    (c) => c.targetKey === targetKey && roomId !== null && c.roomId === roomId
  );
  const flag = (name: PersonalControlFlag) =>
    Boolean(everywhere?.[name]) || (name !== 'blockInvites' && Boolean(inRoom?.[name]));
  return {
    voiceMuted: flag('voiceMuted'),
    hideMessages: flag('hideMessages'),
    hideReactions: flag('hideReactions'),
    hideAvatar: flag('hideAvatar'),
    hideRequests: flag('hideRequests'),
    blockInvites: flag('blockInvites'),
    favourite: flag('favourite'),
    volume:
      inRoom && inRoom.volume !== PERSONAL_VOLUME.default
        ? inRoom.volume
        : (everywhere?.volume ?? PERSONAL_VOLUME.default),
  };
}
