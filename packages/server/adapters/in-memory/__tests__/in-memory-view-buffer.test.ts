import { expectOk } from '@vp/testing/result';
import { inMemoryViewBufferSubject } from '../../__tests__/contract/in-memory-port-subjects';
import { describeViewBufferContract } from '../../__tests__/contract/view-buffer.contract';
import { InMemoryViewBuffer } from '../in-memory-view-buffer';

describeViewBufferContract(inMemoryViewBufferSubject);

describe('InMemoryViewBuffer', () => {
  it('clears the viewers, the buffer and the pending batch', async () => {
    const buffer = new InMemoryViewBuffer();
    const view = { videoId: 'v', viewerId: 's', viewDate: '2026-03-10', watchSeconds: 9 };
    expectOk(await buffer.record(view));
    expectOk(await buffer.snapshot('batch'));
    expectOk(await buffer.record({ ...view, videoId: 'w' }));

    buffer.clear();

    expect(expectOk(await buffer.snapshot('next'))).toBeNull();
    expect(expectOk(await buffer.record(view))).toBe('counted');
  });
});
