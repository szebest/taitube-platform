import { captureLog } from '@vp/testing/log-capture';
import { prettyDestination, prettyLine } from '../pretty-destination';

describe('@vp/logger: prettyLine', () => {
  it('writes the level, the message and every field that is not bookkeeping', () => {
    const json =
      '{"level":"info","time":1,"service":"dev-token","msg":"minted","sub":"u1","ttl":60}';

    expect(prettyLine(json)).toBe('info minted sub=u1 ttl=60\n');
  });

  it('writes an error and its causes on the lines below', () => {
    const err = {
      type: 'Error',
      message: 'mint failed',
      cause: { type: 'Error', message: 'no key', code: 'X' },
    };
    const json = JSON.stringify({ level: 'error', msg: 'could not mint token', err });

    expect(prettyLine(json)).toBe(
      'error could not mint token\n  Error: mint failed\n  caused by Error [X]: no key\n'
    );
  });
});

describe('@vp/logger: prettyDestination', () => {
  it('formats every record in a chunk', () => {
    const target = captureLog();
    const destination = prettyDestination(target.destination);

    destination.write('{"level":"info","msg":"a"}\n{"level":"warn","msg":"b"}\n');

    expect(target.text()).toBe('info a\nwarn b\n');
  });
});
