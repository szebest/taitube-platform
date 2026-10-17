import { stopProcessGroup } from '../process-group';

const killThrowing = (code: string) =>
  vi.spyOn(process, 'kill').mockImplementation(() => {
    throw Object.assign(new Error(code), { code });
  });

describe('stopProcessGroup', () => {
  it('signals the whole group', () => {
    const kill = vi.spyOn(process, 'kill').mockImplementation(() => true);

    stopProcessGroup(4321);

    expect(kill).toHaveBeenCalledWith(-4321, 'SIGTERM');
  });

  it('treats a group that already exited as stopped', () => {
    killThrowing('ESRCH');

    expect(() => stopProcessGroup(4321)).not.toThrow();
  });

  it('rethrows any other failure', () => {
    killThrowing('EPERM');

    expect(() => stopProcessGroup(4321)).toThrow('EPERM');
  });
});
