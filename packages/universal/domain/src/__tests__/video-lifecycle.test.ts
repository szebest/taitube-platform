import { resolveVideoTransition } from '../video-lifecycle';

describe('packages/domain: resolveVideoTransition', () => {
  it('reads a named edge from the table', () => {
    expect(resolveVideoTransition({ edge: 'reprocess' })).toEqual({
      edge: 'reprocess',
      from: ['READY', 'FAILED', 'PROCESSING'],
      to: 'PROBING',
      event: 'video.reprocessing',
    });
  });

  it('keeps the event a pair names', () => {
    expect(
      resolveVideoTransition({ from: 'PROCESSING', to: 'READY', eventType: 'video.ready' })
    ).toEqual({ edge: 'package', from: ['PROCESSING'], to: 'READY', event: 'video.ready' });
  });

  it.each([
    { from: 'LIVE', to: 'READY', edge: 'finalizeLive' },
    { from: 'PROBING', to: 'FAILED', edge: 'failProbe' },
    { from: ['PROCESSING', 'PROBING'], to: 'FAILED', edge: 'fail' },
    { from: 'UPLOADING', to: 'REJECTED', edge: 'reject' },
    { from: ['READY', 'HELD'], to: 'REJECTED', edge: 'takedown' },
    { from: 'READY', to: 'UPLOADING', edge: undefined },
    { from: ['UPLOADING', 'READY'], to: 'PROBING', edge: undefined },
  ] as const)('resolves the pair $from to $to as the $edge edge', ({ from, to, edge }) => {
    expect(resolveVideoTransition({ from, to, eventType: 'x' }).edge).toBe(edge);
  });
});
