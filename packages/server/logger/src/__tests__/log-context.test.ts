import { LogContext } from '../log-context';

describe('@vp/observability: LogContext', () => {
  it('carries its bindings across an await and drops them outside the run', async () => {
    const context = new LogContext();

    const seen = await context.run({ requestId: 'req-1' }, async () => {
      await Promise.resolve();
      return context.current();
    });

    expect(seen).toEqual({ requestId: 'req-1' });
    expect(context.current()).toEqual({});
  });

  it('keeps two concurrent runs apart', async () => {
    const context = new LogContext();
    const read = (requestId: string) =>
      context.run({ requestId }, async () => {
        await Promise.resolve();
        return context.current().requestId;
      });

    expect(await Promise.all([read('a'), read('b')])).toEqual(['a', 'b']);
  });
});
