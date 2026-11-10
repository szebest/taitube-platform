# ModerationQueue

The comments held for review as a listbox, one of them open at a time. It is the list half of the review queue at `/comments/queue`: the open comment, its author's history and every action are the smart wrapper's. It lives in the studio's kit, `apps/client/studio/src/components/comments/moderation-queue/` ([README](README.md)).

## Anatomy

```
 ┌ listbox "Held comments" ──────────┐   ┌ the open comment ─────────────┐
 │ ( Tomek  [Contains a link]   )    │   │ Tomek  [Contains a link]      │
 │ ( Marta  [Held for review]   )  < │   │ On Alfama at 5 a.m.           │
 │ ( Ines   [Matched a word]    )    │   │ comment text                  │
 └───────────────────────────────────┘   │ Recent comments by this author│
                                         │ [Approve a] [Remove r] ...    │
                                         └───────────────────────────────┘
```

| Part | Notes |
|---|---|
| `ModerationQueue.Root` | `role="listbox"`, `aria-multiselectable`, named by `aria-label` |
| `ModerationQueue.Item` | `role="option"`; its children are the caller's (author, excerpt, video, reason) |

## Props

```ts
interface ModerationQueueRootProps extends ComponentPropsWithRef<'div'> {
  active: string | undefined;              // the open comment, the one option in the tab order
  onActiveChange: (id: string) => void;
  selected: ReadonlySet<string>;           // the comments marked with x, for a bulk action
}
interface ModerationQueueItemProps extends ComponentPropsWithRef<'div'> {
  value: string;                           // the comment id
}
```

## Keyboard

Roving focus: one option is in the tab order and focusing an option makes it the open one. Arrow Up and Down, Home and End move between options. The queue's own keys are global to the page and run in the smart wrapper (`useQueueShortcuts`):

| Key | Does | Also a visible button |
|---|---|---|
| `j`, `k` | next, previous comment | Next, Previous |
| `a` | approve | Approve |
| `r` | remove: opens the reason dialog, `1` to `6` pick the reason, Enter confirms | Remove, with its disclosure |
| `h` | hide: at once when Silent, through the reason dialog when Visible | Hide, with its disclosure |
| `b` | ban the author: the dialog asks the reason and the length | Ban |
| `v` | flip the next hide or remove between Silent and Visible | "Next action: Visible" |
| `x` | select or unselect; actions then apply to every selected comment | Select, Unselect |
| `?` | list the keys | Shortcuts |

Every shortcut has a button with a `Kbd` hint and `aria-keyshortcuts`. No shortcut runs while a field has focus, with a modifier held, or while a dialog is open, so typing a note never acts on a comment. The disclosure each button shows is the current value: the channel's default for that action, or the flipped one.

## States

| State | What changes |
|---|---|
| Open | the option has an accent border and ground, `aria-current="true"` |
| Selected | an accent ring, `aria-selected="true"` |
| Acting | the row leaves at once and comes back with a toast if the call fails |
| Empty | the page shows "Nothing to review" in place of the list |

## Tokens

`accent`, `accent-soft`, `border`, `surface`, `radius.card`, `spacing.inset-card`, `gap-inline`.

## Accessibility

- A listbox with one tab stop; the open option is also announced as current.
- Selection is a ring and `aria-selected`, never colour alone.
- Keys are documented in the page (the `?` dialog) and on each button.

## Smart wrapper

| Wrapper | Feature folder | Props | Hooks |
|---|---|---|---|
| `ModerationQueuePage` | `features/comments/components/` | `channel` | `useInfiniteQuery(held)`, `useBulkModeration`, `useModerationAbilities`, `useQueueShortcuts`, `commentSettingsQueryOptions` |

The navigation shows the held count live: `comment.held` reloads the held list, and the entry's badge reads its length.

## In the workbench

Stories: one active, with a selection. Axes: themes by modes, RTL, compact density, 320 px width (the list and the open comment stack).
