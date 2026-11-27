import { type Logger, LogContext, createLogger } from '../../index';

const context = new LogContext();

expectTypeOf(context.run({ requestId: 'r' }, () => 1)).toEqualTypeOf<number>();
expectTypeOf(context.run({ requestId: 'r' }, () => 'x')).toEqualTypeOf<string>();
expectTypeOf(context.run({}, async () => true)).toEqualTypeOf<Promise<boolean>>();

// @ts-expect-error bindings are an object, not a string
context.run('requestId', () => 1);

// @ts-expect-error the work is a function
context.run({}, 1);

expectTypeOf(createLogger({ service: 's', level: 'info', format: 'json' })).toExtend<Logger>();

// @ts-expect-error the format is json or pretty
createLogger({ service: 's', level: 'info', format: 'xml' });

// @ts-expect-error the service name is required
createLogger({ level: 'info', format: 'json' });
