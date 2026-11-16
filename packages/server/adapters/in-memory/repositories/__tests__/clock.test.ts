import { realClock } from '../clock';

describe('in-memory clock', () => {
  it('reads Date.now each time it is called', () => {
    const now = vi.spyOn(Date, 'now').mockReturnValueOnce(1_000).mockReturnValueOnce(2_000);

    expect([realClock(), realClock()]).toEqual([1_000, 2_000]);
    expect(now).toHaveBeenCalledTimes(2);
  });
});
