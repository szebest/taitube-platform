import type { QueryClient } from '@tanstack/react-query';
import type { UserEvent } from '@vp/api-contracts';

type UserEventPayloads = { [Event in UserEvent as Event['type']]: Event['payload'] };

/** One member of the union, in the form a lookup by its `type` keeps correlated with its payload. */
type UserEventOf<Type extends keyof UserEventPayloads> = {
  [Each in Type]: { type: Each; payload: UserEventPayloads[Each] };
}[Type];

type UserEventHandlers = {
  [Type in keyof UserEventPayloads]: (
    payload: UserEventPayloads[Type],
    queryClient: QueryClient
  ) => void;
};

/** What each event does to one tab's query cache; an event type with no entry does not compile. */
export const userEventHandlers: UserEventHandlers = {
  'video.processing': () => undefined,
};

export function applyUserEvent<Type extends keyof UserEventPayloads>(
  queryClient: QueryClient,
  event: UserEventOf<Type>
): void {
  userEventHandlers[event.type](event.payload, queryClient);
}
