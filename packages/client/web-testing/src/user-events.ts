import type { ContractResult, streamMyEvents } from '@vp/api-contracts';
import { stubEventSource } from './live-socket';

type UserStreamEvent = ContractResult<typeof streamMyEvents>;

/**
 * The signed-in viewer's event stream under the spec's control: this tab wins the stream's lock at
 * once, so `UserEventStream` opens its source, and `send` delivers an event on it.
 */
export function streamUserEvents() {
  const source = stubEventSource();
  vi.spyOn(navigator.locks, 'request').mockImplementation(async (name, _options, grant) =>
    grant({ name, mode: 'exclusive' })
  );

  return {
    send: (event: UserStreamEvent) => source.emit(event.type, event),
  };
}
