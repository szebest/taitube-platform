# BulkActionBar

The actions on the rows a table has selected, with the one choice they share: whether the authors are told. It sits in the batch bar of the [DataTable](data-table.md) and is used by the comment inbox over `POST /v1/creator/comments/bulk`. It lives in the studio's kit, `apps/client/studio/src/components/comments/bulk-action-bar/` ([README](README.md)); web has no bulk surface.

## Anatomy

```
 [ Approve ] [ Hide ] [ Remove ] [ Shadow ban ] [ Ban ]   ( Silent | Visible )
   1 actions                                                 2 disclosure
```

| # | Part | Notes |
|---|---|---|
| 1 | `BulkActionBar.Action` | an `outline` small `Button`; `tone="danger"` for the ones that cannot be undone from the bar |
| 2 | `BulkActionBar.Disclosure` | the shared [DisclosureControl](../../components/disclosure-control.md) at `size="sm"` |

The count of selected rows is the batch bar's own, announced by it; this component does not repeat it.

## Props

```ts
interface BulkActionBarRootProps extends ComponentPropsWithRef<'div'> {
  pending?: boolean; // every action and the disclosure wait while a batch runs
}
interface BulkActionBarActionProps extends ComponentPropsWithRef<'button'> {
  tone?: ButtonTone;
}
// Parts: BulkActionBar.Root, .Action, .Disclosure (DisclosureControl props)
```

The root is `role="toolbar"`: name it with `aria-label`. `pending` reaches the parts through context, so the smart wrapper sets it once.

## Smart wrapper

| Wrapper | Feature folder | Props | Hooks |
|---|---|---|---|
| `InboxBulkActions` | `features/comments/components/` | `ids`, `onSettled(refused)` | `useBulkModeration`, `useModerationAbilities` |

It leaves out the actions the viewer's role may not take, applies Approve and Shadow ban at once, applies Hide and Remove at once when the disclosure is Silent and through the reason dialog when it is Visible (a visible action needs a reason), and always asks for the reason and the length before a Ban. A refused id is named in a `Toast` with why, and its row stays selected.

## States

| State | What changes |
|---|---|
| Idle | every action enabled |
| Pending | every action and the disclosure disabled |
| Role without an action | that action is absent, not disabled |

## Accessibility

- A toolbar of native buttons in reading order; the disclosure is a radio group inside it.
- Nothing is announced by colour alone: danger actions carry their words.

## Tokens and extension

`gap-inline` between parts; every colour comes from `Button` and `SegmentedControl`. `className` on every part.

## In the workbench

Stories: idle, pending. Axes: themes by modes, RTL, compact density, 320 px width (the bar wraps).
