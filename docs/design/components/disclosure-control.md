# DisclosureControl

The Silent or Visible switch of comment moderation: whether the author of a moderated comment is told. It is a [SegmentedControl](../primitives/segmented-control.md) with the two options and their words fixed, so the dialog, the bulk bar and the queue say the same thing in the same place. In `@vp/components` because web's moderation dialog and studio's bulk bar, queue and settings defaults all render it.

## Anatomy

```
 Tell the author                                  1 group name (the caller's label or the default)
 ┌───────────────────────────────┐
 │ ( 2 Silent )     3 Visible    │                 2 selected segment, 3 the other
 └───────────────────────────────┘
 4 The comment disappears and the author is not told.   caller's line under the control
```

| # | Region | Notes |
|---|---|---|
| 1 | Group name | the radio group's `aria-label`: "Visibility to the author" unless the caller passes its own |
| 2, 3 | Segments | `Silent` and `Visible`, from `useUiCopy()`; exactly one is always chosen |
| 4 | Explanation | not part of the control: the caller puts a `fg-muted` `caption` line under it saying what the author sees for the chosen value and the action in hand |

## Props

Plus the standard props and every `SegmentedControl.Root` prop except `value`, `defaultValue`, `onValueChange`, `children` and `tone`. The tone stays `neutral`: the control picks a fact about the action, never a primary mode.

```ts
// types.ts
export type DisclosureOption = 'silent' | 'visible';
```

```ts
interface DisclosureControlProps {
  value: DisclosureOption;
  onValueChange: (value: DisclosureOption) => void;
  size?: SegmentedSize; // default 'md'; the bulk bar and the queue's action row use 'sm'
}
```

```tsx
<DisclosureControl value={disclosure} onValueChange={setDisclosure} />
<p className="text-caption text-fg-muted">{explanation}</p>
```

The value is controlled: the dialog presets it to the channel's default for the action, the queue keeps it between actions and flips it with `v`. The type is structurally the `Disclosure` of `@vp/domain`, so a value goes in and out with no mapping.

## Extension points

| Need | Point |
|---|---|
| A one-off tweak | `className` |
| A different group name | `aria-label` |
| A smaller control in a bar | `size="sm"` |
| A local look | wrap it; the segments are `SegmentedControl` items and take its `tv()` extension |

## Variants

| Prop | Difference |
|---|---|
| `size` | `sm`, `md`, `lg` as for `SegmentedControl` |

## States

| State | What changes |
|---|---|
| Silent chosen | the `Silent` segment is the raised one |
| Visible chosen | the `Visible` segment is the raised one |
| Disabled | the group is not interactive, both segments at the disabled opacity; used while the action is in flight |
| Focus | one visible focus ring on the checked segment, arrow keys move and choose |

## Responsive behaviour

The control is as wide as its two segments and never wraps. In a dialog on compact it takes the full width with `className="w-full"`, so each segment is a 44 px touch target.

## Motion

The raised segment slides between the two at `fast` with `settle`, as every `SegmentedControl` does; reduced motion swaps it with no slide.

## Accessibility

- A radio group named by `aria-label`; the two segments are radios, so the choice is announced as "Silent, 1 of 2, selected".
- Arrow keys move and choose, Tab enters and leaves the group once.
- The choice is never carried by colour: the segment's text says it.
- The explanation line under the control is associated with it by the caller through `aria-describedby`.

## Composition

`SegmentedControl` and `useUiCopy()` for `disclosureLabel`, `disclosureSilent` and `disclosureVisible`.

## Used by

- Web: [113](../../tickets/113-channel-comment-moderation.md), the moderation dialog opened from a comment's menu
- Studio: [113](../../tickets/113-channel-comment-moderation.md), the inbox bulk bar, the moderation queue and the visibility defaults of `/comments/settings`

## Workbench stories

- Silent
- Visible
- Small
- Disabled
- Flipping from Silent to Visible
