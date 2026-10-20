import type { userEventHandlers } from '../../user-event-handlers';

// @ts-expect-error an event type with no cache handler does not compile
const _missingHandler: typeof userEventHandlers = {};
