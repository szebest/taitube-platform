import { expectOk } from '@kit/testing/result';
import { EDIT_BASE_RETENTION_MS } from '@vp/domain';
import type { MakeRepositoriesSubject } from './subjects';
import {
  CHAPTERS,
  NOW,
  VIDEO,
  chaptersOf,
  curveOf,
  edit,
  render,
  rowOf,
  seedRetention,
  video,
  videoGenerationContractContext,
} from './video-generation-contract-context';

export function describeVideoGenerationRevertContract(makeSubject: MakeRepositoriesSubject): void {
  describe('VideoGenerationRepository contract: revert', () => {
    const ctx = videoGenerationContractContext(makeSubject);
    const revert = (expectedVersion: number, now = NOW) =>
      ctx.generations.swap({
        videoId: VIDEO,
        generation: 1,
        claim: { type: 'revert', expectedVersion },
        now,
      });

    it('reverts to the base under the current version only, restoring its timeline and curve', async () => {
      await seedRetention(ctx);
      await edit(ctx, 2);
      await render(ctx, 2, 210_000);
      const edited = await video(ctx);

      expect(expectOk(await revert(edited.version - 1))).toEqual({ type: 'superseded' });
      expect(expectOk(await revert(edited.version))).toMatchObject({ type: 'swapped' });
      expect(await video(ctx)).toMatchObject({ generation: 1, durationMs: 240_000 });
      expect(await chaptersOf(ctx)).toEqual(CHAPTERS);
      expect(await curveOf(ctx)).toEqual([{ percent: 0, viewers: 7 }]);
      expect(await rowOf(ctx, 2)).toMatchObject({ status: 'retired' });
      expect(expectOk(await ctx.generations.findEdit(VIDEO))).toMatchObject({
        status: 'reverted',
      });
    });

    it.each([
      ['swaps back to a base inside its window', EDIT_BASE_RETENTION_MS - 1, 'swapped', 1, 1],
      ['fences a revert at the end of the window', EDIT_BASE_RETENTION_MS, 'fenced', 2, 0],
      ['fences a revert past the window', EDIT_BASE_RETENTION_MS + 1, 'fenced', 2, 0],
    ] as const)('%s', async (_name, afterMs, outcome, generation, versionBump) => {
      await edit(ctx, 2);
      await render(ctx, 2);
      const { version } = await video(ctx);

      const reverted = await revert(version, new Date(NOW.getTime() + afterMs));

      expect(expectOk(reverted).type).toBe(outcome);
      expect(await video(ctx)).toMatchObject({ generation, version: version + versionBump });
    });
  });
}
