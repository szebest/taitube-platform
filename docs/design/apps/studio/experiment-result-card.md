# ExperimentResultCard

One title or thumbnail test with its numbers per variant: watch time per impression as the headline, then click-through, average view and impressions. It is the body of each test on the video editor's Tests tab ([116](../../../tickets/116-video-management-power-tools.md)) and lives in the studio's kit, `apps/client/studio/src/components/analytics/experiment-result-card/` ([README](README.md)); web shows no results.

## Anatomy

```
┌──────────────────────────────────────────────────────────────────────┐
│ 1 Title test  [Running]  Started 1 Mar 2026                          │
│ 2 Not enough data yet                                                │
│   Every variant needs 1,000 impressions before its numbers mean ...  │
│ 3 ┌ Variant A, the control ┐ ┌ Variant B ──────────┐                 │
│   │ 420                    │ │ 380                  │                 │
│   │ ▓▓▓▓░░░░░░             │ │ ▓▓▓░░░░░░░           │                 │
│   │ 420 of 1,000 impr.     │ │ 380 of 1,000 impr.   │                 │
│   └────────────────────────┘ └──────────────────────┘                 │
│ 4 Variant | Shows | Impressions | Watch/impr. | CTR | Avg view | [Apply B] │
│ 5                                                    [ Stop the test ] │
└──────────────────────────────────────────────────────────────────────┘
```

| # | Part | Notes |
|---|---|---|
| 1 | `Header` | `Card.Header`; the caller puts the heading, the status `Badge` and the start date in it |
| 2 | `Summary`, not enough data | while `results.enoughData` is false: the line and why |
| 3 | `Summary`, per variant | a `StatCard` each. With enough data its value is watch seconds per impression (`number` in seconds, one decimal) captioned "Watch time per impression"; before that, the impressions so far, a `Progress` to 1,000 named "n of 1,000 impressions", and the same words below it. Variant A reads "the control"; the winner of a finished test carries a `success` `Badge` |
| 4 | `Variants` | a `Table`: variant (a row header), what it shows (the title, and the thumbnail source when it has one), impressions, watch time per impression, click-through (`percent`), average view (`duration` in words). A withheld ratio reads "Not yet", never a rounded zero. The actions column is drawn only when `action` is given |
| 5 | `Footer` | `Card.Footer`; the caller's Stop |

## Props

```ts
// types.ts
type ExperimentResultCardExperiment = Pick<ExperimentView, 'variants' | 'results' | 'status' | 'winnerVariantId'>;
type ExperimentResultCardVariant = ExperimentView['variants'][number] & {
  result: ExperimentView['results']['variants'][number] | undefined;
  winner: boolean; // finished and applied by the creator
};
```

```ts
interface ExperimentResultCardRootProps extends ComponentPropsWithRef<'article'> {
  experiment: ExperimentResultCardExperiment;
}
interface ExperimentResultCardVariantsProps extends ComponentPropsWithRef<'table'> {
  action?: (variant: ExperimentResultCardVariant) => ReactNode; // Apply, per row
}
// Parts: ExperimentResultCard.Root, .Header, .Summary, .Variants, .Footer, .Skeleton
```

`Root` joins each variant with its result and hands them to the parts through `useExperimentResultCard()`; the card never decides anything: the ratios, `enoughData` and the winner come from the API (`experimentResults` in `@vp/domain`). Name the `article` with `aria-labelledby` on the caller's heading.

## Smart wrapper

| Wrapper | Feature folder | Props | Hooks |
|---|---|---|---|
| `ExperimentsPanel` | `features/videos/components/` | `video` | `useQuery(experimentsQueryOptions)`, `useMutation(stop/applyExperimentMutationOptions)`, `useFailureToast` |

It lists the tests newest first as the API answers them, puts the kind, status and start date in `Header`, gives `Variants` an Apply per variant and `Footer` a Stop while the test runs, applies under the video's `version` and opens the shared `VersionConflictDialog` on a 409 (reload, or apply again on the newest version). `StartExperimentForm` above the list starts the next one.

## States

| State | What changes |
|---|---|
| Not enough data | the line, impressions and a `Progress` per variant, every ratio "Not yet" |
| Counted | watch time per impression per variant, every ratio filled |
| Finished | the applied variant marked Winner in the summary and the table; no actions |
| Stopped | no winner, no actions |
| Loading | `ExperimentResultCard.Skeleton`: the heading bar, two `StatCardSkeleton`s and the table block, the loaded card's layout |

## Responsive behaviour

The summary is one column at compact and three from medium; the table scrolls inside `Table.Root`'s scroller, never the page.

## Accessibility

An `article` named by its heading; each `Progress` is named with the words below it; the variant cell is a row header; the winner is a word in a `Badge`, never colour alone; numbers go through `@kit/intl-react`.

## Workbench stories

`Studio/ExperimentResultCard`: NotEnoughData, Counted, Finished, Stopped, Loading.
