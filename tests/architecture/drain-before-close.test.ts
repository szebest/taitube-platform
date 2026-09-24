import { read } from './repo-files';

/**
 * Readiness has to fail while the listener still accepts, or a load balancer keeps routing to a
 * server that is about to refuse. The behaviour is driven against a real listen() in
 * apps/api/src/__tests__/main.test.ts; this holds the ordering in place for every process.
 */
function drainsBeforeClosing(source: string): boolean {
  const drain = source.indexOf('plan.drain()');
  const close = source.search(/plan\.close\(\)|drainThenClose\(plan\)/);
  return drain !== -1 && close !== -1 && drain < close;
}

function runBody(source: string): string {
  return source.slice(source.indexOf('const run = async'));
}

function readinessFailsFirst(source: string): boolean {
  const body = source.slice(source.indexOf('async report()'));
  return (
    body.indexOf('this.draining') !== -1 &&
    body.indexOf('this.draining') < body.indexOf('checkHealth')
  );
}

describe('architecture: a process drains before it closes', () => {
  it('recognises a shutdown that closes the server before flipping readiness', () => {
    expect(drainsBeforeClosing('await plan.close();\nplan.drain();')).toBe(false);
    expect(
      drainsBeforeClosing('plan.drain();\nawait sleep(plan.drainDelayMs);\nawait plan.close();')
    ).toBe(true);
  });

  it('flips readiness before it closes, in the one shutdown both processes run', () => {
    expect(drainsBeforeClosing(runBody(read('packages/server/composition/src/shutdown.ts')))).toBe(
      true
    );
  });

  it.each(['apps/api/src/serve.ts', 'apps/worker/src/process.ts'])(
    'shuts %s down through it',
    (file) => {
      expect(read(file)).toMatch(/shutdownOnce\(\{[\s\S]*drain: /);
    }
  );

  it('answers /readyz from the drain flag before it asks any dependency', () => {
    expect(readinessFailsFirst(read('apps/api/src/services/readiness-service.ts'))).toBe(true);
    expect(read('apps/api/src/serve.ts')).toContain('readiness.beginDrain()');
  });
});
