import { captureLog } from '@vp/testing/log-capture';
import { prettyDestination } from '../pretty-destination';

describe('@vp/logger: prettyDestination', () => {
  it('formats every record in a chunk', () => {
    const target = captureLog();
    const destination = prettyDestination(target.destination);

    destination.write('{"level":"info","msg":"a"}\n{"level":"warn","msg":"b"}\n');

    expect(target.text()).toBe('info a\nwarn b\n');
  });
});
