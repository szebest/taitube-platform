import { captureLog } from '@vp/testing/log-capture';
import { LogContext } from '../log-context';
import { createLogger } from '../logger';

describe('@vp/observability: createLogger', () => {
  it('names its service and level on every line', () => {
    const { destination, lines } = captureLog();
    createLogger({ service: 'vp-api', level: 'info', destination }).info('hello');

    expect(lines()).toEqual([
      expect.objectContaining({ service: 'vp-api', level: 'info', msg: 'hello' }),
    ]);
  });

  it.each([
    ['authorization', { req: { headers: { authorization: 'Bearer secret-token' } } }],
    ['cookie', { req: { headers: { cookie: 'session=secret-token' } } }],
    ['x-admin-token', { req: { headers: { 'x-admin-token': 'secret-token' } } }],
    ['a bare headers object', { headers: { authorization: 'Bearer secret-token' } }],
    ['a request error', { err: { headers: { authorization: 'Bearer secret-token' } } }],
  ])('redacts %s', (_name, payload) => {
    const { destination, lines } = captureLog();
    createLogger({ service: 'vp-api', level: 'info', destination }).info(payload, 'request');

    expect(JSON.stringify(lines())).not.toContain('secret-token');
    expect(JSON.stringify(lines())).toContain('[Redacted]');
  });

  it('adds what the log context carries to lines written inside it', () => {
    const { destination, lines } = captureLog();
    const context = new LogContext();
    const logger = createLogger({ service: 'vp-worker', level: 'info', destination, context });

    context.run({ requestId: 'req-1' }, () => logger.child({ stage: 'probe' }).info('inside'));
    logger.info('outside');

    expect(lines()).toEqual([
      expect.objectContaining({ msg: 'inside', requestId: 'req-1', stage: 'probe' }),
      expect.not.objectContaining({ requestId: expect.anything() }),
    ]);
  });
});
