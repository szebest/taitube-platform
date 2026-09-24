import { captureLog } from '@vp/testing/log-capture';
import { LogContext } from '../log-context';
import { type LogFormat, createLogger } from '../logger';

function loggerTo(format: LogFormat, context?: LogContext) {
  const log = captureLog();
  const logger = createLogger({
    service: 'vp-api',
    level: 'info',
    format,
    destination: log.destination,
    context,
  });
  return { log, logger };
}

describe('@vp/logger: createLogger', () => {
  it.each([
    ['json', '{"level":"info"', 'probe queued'],
    ['pretty', 'info probe queued videoId=v1', 'videoId=v1'],
  ] as const)('writes a %s line with its message and fields', (format, start, fragment) => {
    const { log, logger } = loggerTo(format);

    logger.info({ videoId: 'v1' }, 'probe queued');

    expect(log.text().startsWith(start)).toBe(true);
    expect(log.text()).toContain(fragment);
  });

  it('writes a pretty line without JSON or the service name', () => {
    const { log, logger } = loggerTo('pretty');

    logger.warn('stack not ready');

    expect(log.text()).toBe('warn stack not ready\n');
  });

  it.each([
    ['authorization', { req: { headers: { authorization: 'Bearer secret-token' } } }],
    ['cookie', { req: { headers: { cookie: 'session=secret-token' } } }],
    ['x-admin-token', { req: { headers: { 'x-admin-token': 'secret-token' } } }],
    ['a bare headers object', { headers: { authorization: 'Bearer secret-token' } }],
    ['a request error', { err: { headers: { authorization: 'Bearer secret-token' } } }],
  ])('redacts %s', (_name, payload) => {
    const { log, logger } = loggerTo('json');

    logger.info(payload, 'request');

    expect(log.text()).not.toContain('secret-token');
    expect(log.text()).toContain('[Redacted]');
  });

  it.each(['json', 'pretty'] as const)('serializes an error field in %s', (format) => {
    const { log, logger } = loggerTo(format);
    const failure = Object.assign(new Error('encode failed'), { code: 'FFMPEG_FAILED' });

    logger.error({ err: new Error('probe failed', { cause: failure }) }, 'probe failed');

    expect(log.text()).toContain('encode failed');
    expect(log.text()).toContain('FFMPEG_FAILED');
  });

  it('adds what the log context carries to lines written inside it', () => {
    const context = new LogContext();
    const { log, logger } = loggerTo('json', context);

    context.run({ requestId: 'req-1' }, () => logger.child({ stage: 'probe' }).info('inside'));
    logger.info('outside');

    expect(log.lines()).toEqual([
      expect.objectContaining({ msg: 'inside', requestId: 'req-1', stage: 'probe' }),
      expect.not.objectContaining({ requestId: expect.anything() }),
    ]);
  });
});
