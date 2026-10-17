import { stopProcessGroup } from '../process-group';

const failingWith = (code: string) => () => {
  throw Object.assign(new Error(code), { code });
};

const stopWithKill = (kill: () => true = () => true) => {
  const spy = vi.spyOn(process, 'kill').mockImplementation(kill);
  return { kill: spy, stop: () => stopProcessGroup(4321) };
};

describe('stopProcessGroup', () => {
  it('signals the whole group', () => {
    const { kill, stop } = stopWithKill();

    stop();

    expect(kill).toHaveBeenCalledWith(-4321, 'SIGTERM');
  });

  it('treats a group that already exited as stopped', () => {
    expect(stopWithKill(failingWith('ESRCH')).stop).not.toThrow();
  });

  it('rethrows any other failure', () => {
    expect(stopWithKill(failingWith('EPERM')).stop).toThrow('EPERM');
  });
});
