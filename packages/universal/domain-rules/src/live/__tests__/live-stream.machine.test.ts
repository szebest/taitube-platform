import { machineFindings } from '@vp/machine';
import { LIVE_STREAM } from '../live-stream.machine';

describe('@vp/domain-rules: LIVE_STREAM', () => {
  it('has no structural finding', () => {
    expect(machineFindings(LIVE_STREAM)).toEqual([]);
  });

  it('is on air in exactly the states a stop can be requested, as the rules assume', () => {
    expect(LIVE_STREAM.sources('end')).toEqual(LIVE_STREAM.sources('requestStop'));
  });
});
