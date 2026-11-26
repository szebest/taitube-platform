import { dt } from '@vp/shared-messages';

const VARIANT = { a: 'A', b: 'B', c: 'C' } as const;
const KIND = { title: 'Title', thumbnail: 'Thumbnail', both: 'Title and thumbnail' } as const;

export const studioExperiments = {
  experimentsTitle: dt('Tests'),
  experimentsDescription: dt(
    'Show each viewer one of two or three titles and compare the watch time each one earns per impression. You pick the winner: nothing changes on its own.'
  ),
  experimentsEmpty: dt('No tests yet.'),
  experimentsLoadFailed: dt('The tests did not load.'),
  experimentsListLabel: dt('Tests of this video'),
  experimentStartTitle: dt('Start a test'),
  experimentKind: dt('What to test'),
  experimentKindOption: dt('{kind:enum}', { enum: { kind: KIND } }),
  experimentThumbnailsNeeded: dt('{count:plural}', {
    plural: {
      count: {
        one: 'Thumbnail tests compare two thumbnails of this video, and it has one.',
        other: 'Thumbnail tests compare two thumbnails of this video, and it has {?}.',
      },
    },
  }),
  experimentVariantCount: dt('Variants'),
  experimentVariantCountOption: dt('{count:plural}', {
    plural: { count: { one: '{?} variant', other: '{?} variants' } },
  }),
  experimentVariantTitle: dt('Title, variant {variant:enum}', { enum: { variant: VARIANT } }),
  experimentControlTitle: dt('Title, variant {variant:enum} (the control)', {
    enum: { variant: VARIANT },
  }),
  experimentControlHint: dt('The current title. Change it on the Details tab.'),
  experimentInvalidTitles: dt('Give each variant a different title of {min} to {max} characters.'),
  experimentRunningAlready: dt(
    'A test is running on this video. Stop it or apply a variant before starting another.'
  ),
  experimentStart: dt('Start the test'),
  experimentStarted: dt('Test started'),
  experimentStartFailed: dt('The test did not start.'),
  experimentHeading: dt('{kind:enum} test', { enum: { kind: KIND } }),
  experimentStatus: dt('{status:enum}', {
    enum: { status: { running: 'Running', finished: 'Finished', stopped: 'Stopped' } },
  }),
  experimentStartedAt: dt('Started {date:date}', { date: { date: { style: 'medium' } } }),
  experimentStop: dt('Stop the test'),
  experimentStopped: dt('Test stopped. Every viewer sees the current title again.'),
  experimentStopFailed: dt('The test was not stopped.'),
  experimentApply: dt('Apply {variant:enum}', { enum: { variant: VARIANT } }),
  experimentApplied: dt('Variant applied'),
  experimentApplyFailed: dt('The variant was not applied.'),
  experimentVariant: dt('Variant {variant:enum}', { enum: { variant: VARIANT } }),
  experimentControl: dt('Variant {variant:enum}, the control', { enum: { variant: VARIANT } }),
  experimentWinner: dt('Winner'),
  experimentHeadline: dt('Watch time per impression'),
  experimentClickThrough: dt('Click-through'),
  experimentAverageView: dt('Average view'),
  experimentImpressions: dt('Impressions'),
  experimentVariantColumn: dt('Variant'),
  experimentShows: dt('Shows'),
  experimentThumbnail: dt('{source:enum} thumbnail', { enum: { source: { poster: 'Poster' } } }),
  experimentNoValue: dt('Not yet'),
  experimentNotEnoughData: dt('Not enough data yet'),
  experimentNotEnoughDataBody: dt(
    'Every variant needs {min:number} impressions before its numbers mean anything.'
  ),
  experimentImpressionsSoFar: dt('{count:number} of {min:number} impressions'),
  experimentResultsLabel: dt('Results per variant'),
  experimentActions: dt('Actions'),
} as const;
