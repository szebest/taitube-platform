import { err, ok } from '@kit/result';
import { ErrorCodes } from '@vp/errors';
import { decideExperiment } from '../decide-experiment.rule';

const CONTEXT = {
  video: { id: 'video-1', posterKey: 'videos/video-1/poster.jpg' },
  runningOnVideo: false,
  runningOnChannel: 0,
};

describe('@vp/domain-rules: decideExperiment', () => {
  it('letters the variants from the control and keeps only the titles of a title test', () => {
    const decided = decideExperiment(
      {
        kind: 'title',
        variants: [
          { title: ' First ', thumbnail: { source: 'poster' } },
          { title: 'Second' },
          { title: 'Third' },
        ],
      },
      CONTEXT
    );

    expect(decided).toEqual(
      ok([
        { id: 'a', title: 'First', thumbnail: null },
        { id: 'b', title: 'Second', thumbnail: null },
        { id: 'c', title: 'Third', thumbnail: null },
      ])
    );
  });

  it.each([
    { name: 'one variant', variants: [{ title: 'Only' }], field: 'variants' },
    {
      name: 'four variants',
      variants: [{ title: 'A' }, { title: 'B' }, { title: 'C' }, { title: 'D' }],
      field: 'variants',
    },
    { name: 'an empty title', variants: [{ title: 'A' }, { title: '  ' }], field: 'title' },
    { name: 'a missing title', variants: [{ title: 'A' }, {}], field: 'title' },
    {
      name: 'a title over 255',
      variants: [{ title: 'A' }, { title: 'x'.repeat(256) }],
      field: 'title',
    },
    {
      name: 'the same title twice',
      variants: [{ title: 'Same' }, { title: ' Same' }],
      field: 'title',
    },
  ])('refuses a title test with $name', ({ variants, field }) => {
    expect(decideExperiment({ kind: 'title', variants }, CONTEXT)).toMatchObject(
      err({ code: ErrorCodes.VALIDATION_FAILED, field })
    );
  });

  it.each(['thumbnail', 'both'] as const)(
    'refuses a %s test while the video has fewer than two thumbnails',
    (kind) => {
      const variants = [
        { title: 'A', thumbnail: { source: 'poster' } },
        { title: 'B', thumbnail: { source: 'poster' } },
      ] as const;

      expect(decideExperiment({ kind, variants }, CONTEXT)).toMatchObject(
        err({ code: ErrorCodes.VALIDATION_FAILED, field: 'kind' })
      );
    }
  );

  it.each([
    { name: 'one is running on the video', running: { runningOnVideo: true }, scope: 'video' },
    { name: 'the channel runs five', running: { runningOnChannel: 5 }, scope: 'channel' },
  ])('refuses a new test when $name', ({ running, scope }) => {
    const input = { kind: 'title', variants: [{ title: 'A' }, { title: 'B' }] } as const;

    expect(decideExperiment(input, { ...CONTEXT, ...running })).toMatchObject(
      err({ code: ErrorCodes.EXPERIMENT_LIMIT, scope })
    );
  });

  it('allows a fifth test on the channel', () => {
    const input = { kind: 'title', variants: [{ title: 'A' }, { title: 'B' }] } as const;

    expect(decideExperiment(input, { ...CONTEXT, runningOnChannel: 4 }).ok).toBe(true);
  });
});
