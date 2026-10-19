import type { UserEvent } from '@vp/api-contracts';

type UserEventOf<Type extends UserEvent['type']> = Extract<UserEvent, { type: Type }>;

/** The signed-in viewer's events fed into this tab's query cache; each app root mounts it once. */
export function UserEventStream() {
  return null;
}

export function useUserEvent<Type extends UserEvent['type']>(
  _type: Type,
  _handler: (payload: UserEventOf<Type>['payload']) => void
): void {}
