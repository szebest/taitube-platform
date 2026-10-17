/** Stops a process group; one that already exited (`ESRCH`) is already stopped, anything else is a fault. */
export function stopProcessGroup(pid: number): void {
  try {
    process.kill(-pid, 'SIGTERM');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ESRCH') throw error;
  }
}
