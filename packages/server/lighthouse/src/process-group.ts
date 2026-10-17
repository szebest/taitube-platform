import { tryCatch } from '@vp/result';

/** Stops a process group; one that already exited (`ESRCH`) is already stopped, anything else is a fault. */
export function stopProcessGroup(pid: number): void {
  const stopped = tryCatch(
    () => process.kill(-pid, 'SIGTERM'),
    (cause) => cause as NodeJS.ErrnoException
  );
  if (!stopped.ok && stopped.error.code !== 'ESRCH') throw stopped.error;
}
