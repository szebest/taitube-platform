import { captureLog } from '../log-capture';

describe('@vp/testing: captureLog', () => {
  it('parses each written line, however the writes were split', () => {
    const log = captureLog();

    log.destination.write('{"msg":"a"}\n{"ms');
    log.destination.write('g":"b"}\n');

    expect(log.lines()).toEqual([{ msg: 'a' }, { msg: 'b' }]);
    expect(log.text()).toBe('{"msg":"a"}\n{"msg":"b"}\n');
  });
});
