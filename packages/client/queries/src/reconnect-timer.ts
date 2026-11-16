const FIRST_RETRY_MS = 1_000;
const LAST_RETRY_MS = 30_000;

/**
 * Reopens a dropped connection: each retry waits twice as long as the one before, from 1 s up to
 * 30 s, until `reset` says the server answered.
 */
export function createReconnectTimer(reconnect: () => void) {
  let retries = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;

  return {
    schedule: () => {
      timer = setTimeout(reconnect, Math.min(FIRST_RETRY_MS * 2 ** retries, LAST_RETRY_MS));
      retries += 1;
    },
    reset: () => {
      retries = 0;
    },
    cancel: () => clearTimeout(timer),
  };
}
