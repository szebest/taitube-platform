import { videoLifecycleEdgeOf } from '../video-lifecycle';

describe('packages/domain: videoLifecycleEdgeOf', () => {
  it.each([
    { from: 'PROCESSING', to: 'READY', edge: 'package' },
    { from: 'LIVE', to: 'READY', edge: 'finalizeLive' },
    { from: 'PROBING', to: 'FAILED', edge: 'failProbe' },
    { from: ['PROCESSING', 'PROBING'], to: 'FAILED', edge: 'fail' },
    { from: 'UPLOADING', to: 'REJECTED', edge: 'reject' },
    { from: ['READY', 'HELD'], to: 'REJECTED', edge: 'takedown' },
    { from: 'READY', to: 'UPLOADING', edge: undefined },
    { from: ['UPLOADING', 'READY'], to: 'PROBING', edge: undefined },
  ] as const)('resolves $from to $to as $edge', ({ from, to, edge }) => {
    expect(videoLifecycleEdgeOf(from, to)).toBe(edge);
  });
});
