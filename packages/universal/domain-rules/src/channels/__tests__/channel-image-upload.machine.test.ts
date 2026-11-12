import { machineFindings } from '@vp/machine';
import { CHANNEL_IMAGE_UPLOAD } from '../channel-image-upload.machine';

describe('@vp/domain-rules: CHANNEL_IMAGE_UPLOAD', () => {
  it('has no structural finding', () => {
    expect(machineFindings(CHANNEL_IMAGE_UPLOAD)).toEqual([]);
  });

  it.each([
    { from: 'queued', event: 'purge' },
    { from: 'purged', event: 'fail' },
    { from: 'superseded', event: 'commit' },
    { from: 'ready', event: 'fail' },
  ] as const)('refuses $event from $from', ({ from, event }) => {
    expect(CHANNEL_IMAGE_UPLOAD.next(from, event)).toBeUndefined();
  });
});
