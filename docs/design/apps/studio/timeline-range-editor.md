# TimelineRangeEditor

One slider over a video's frames: two thumbs for a range, or one for a position, with a tick for each point already set. It is the editor's way of picking a moment without typing it: the corrections panel picks a 2 to 30 second range, and the chapters panel scrubs a position to take a chapter's start from. It lives in the studio's kit, `apps/client/studio/src/components/video/timeline-range-editor/` ([README](README.md)), and builds on the `Slider` primitive and `SpriteStrip` from `@kit/components` ([116](../../../tickets/116-video-management-power-tools.md)).

## Anatomy

```
 +--------------------------------------------------+
 | frame | frame | frame | frame | frame | frame |   1 SpriteStrip, outside the range dimmed
 |       |  |          |                |            2 ticks, one per point already set
 |  o=========o-------------------------------------|   3 slider, a thumb per end
 +--------------------------------------------------+
 0:10 to 0:15                                           4 summary, announced as it changes
```

| # | Part | Notes |
|---|---|---|
| 1 | Frames | `SpriteStrip` over `sprite`; absent without one, and the slider stands alone |
| 2 | Ticks | `aria-hidden`, never focusable; each carries its `label` as `title` and the active one is `accent` |
| 3 | Slider | `Slider.Root` in whole seconds, a `Slider.Thumb` named by the caller for each value |
| 4 | Summary | a polite live region with the words the caller finishes |

## Props

```ts
interface TimelineRangeEditorProps extends Omit<ComponentPropsWithRef<'fieldset'>, 'children' | 'onChange'> {
  durationMs: number;
  control: RangeControl | PositionControl;
  sprite?: SpriteSheet;
  markers?: readonly TimelineMarker[]; // { id, ms, label, active? }
  summary: string;
}
interface RangeControl {
  mode: 'range';
  range: { startMs: number; endMs: number };
  onRangeChange: (range: TimelineRange) => void;
  minSpanMs: number;
  maxSpanMs: number;
  startLabel: string;
  endLabel: string;
}
interface PositionControl {
  mode: 'position';
  positionMs: number;
  onPositionChange: (positionMs: number) => void;
  label: string;
}
```

The root is a `fieldset`: name it with `aria-label`. Every word, the thumbs' names, the tick labels and the summary, arrives through props, so the part holds no copy and no product name. It is controlled and keeps no state.

## Smart wrappers

| Wrapper | Feature folder | Control | Markers |
|---|---|---|---|
| `ChaptersPanel` | `features/videos/components/` | `position`: the scrub position; each row's "Use the playhead" button writes it into that row's time field | one per row with a readable time, the focused row active |
| `CorrectionsPanel` | `features/videos/components/` | `range`: 2 to 30 seconds, bound to the start and end fields | the start of each saved correction, the one being edited active |

The studio has no player, so the scrub thumb stands in for the playhead. The `m:ss` text fields stay beside the slider as the way to type an exact time and the accessible fallback: the slider and the fields hold one value, and changing either moves the other. Without a known duration the wrapper draws no slider and no playhead button.

## States

| State | What changes |
|---|---|
| No sprite | no frames; the slider and ticks remain |
| Range at its longest | dragging the far thumb out pulls the other along, so the thumb under the pointer never stops |
| Range at its shortest | the thumbs stop `minSpanMs` apart |

## Accessibility

- Thumbs are native slider roles named by the caller; arrow keys move one second, Home and End the ends.
- Ticks and frames are decoration (`aria-hidden`) and take no focus, so the control adds no keyboard trap.
- The summary says the same range in words, and the text fields carry the same value.
- Nothing animates beyond the slider's own thumb transition, which `motion-reduce` turns off.

## In the workbench

Stories: range, position with markers, without frames. Axes: themes by modes, RTL (ticks use `inset-inline-start`), 320 px width.
