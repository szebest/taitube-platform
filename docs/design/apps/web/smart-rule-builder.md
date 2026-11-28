# SmartRuleBuilder

Location: `apps/client/web/src/components/playlist/smart-rule-builder/`. Web's app kit, presentational and compound, built from `Button`, `IconButton` and `Icon`. It is layout only and holds no form state.

The form layout for a smart playlist's rules: a "match all or any" header, a list of condition rows, an add button, and sort and limit controls. The caller binds its TanStack Form fields into the parts.

## Anatomy

```
┌ fieldset ──────────────────────────────────────────────┐
│ Videos that match [all of these v]                      │  Match
│ ┌────────────────────────────────────────────────────┐ │
│ │ [Channel v] [ Marta Reis Films x ]                [x]│ │  Condition
│ └────────────────────────────────────────────────────┘ │
│ ┌────────────────────────────────────────────────────┐ │
│ │ [Duration v] under 10 minutes  ======o======      [x]│ │
│ └────────────────────────────────────────────────────┘ │
│ [+ Add condition]                                       │  Add
│ ────────────────────────────────────────────────────── │
│ [Newest first v]  Up to 50 videos                       │  Footer
└─────────────────────────────────────────────────────────┘
```

| Part | Notes |
|---|---|
| `Root` | a `fieldset`, column with `stack` gap; pass `aria-label` (it is the group's name) |
| `Match` | a wrapping header row for the caller's match control |
| `Conditions` | an `ol` of rows, `inline` gap |
| `Condition` | a `li` card (`card` radius, hairline, `surface`): the caller's controls in a wrapping row, an `IconButton` with `close` at the end |
| `Add` | an outline `Button` with a `plus`, aligned to the start |
| `Footer` | a wrapping row under a hairline, for sort and limit |

## Props

```ts
interface SmartRuleBuilderConditionProps extends ComponentPropsWithRef<'li'> {
  onRemove: () => void;
  removeLabel: string;
}
```

`Add` is a `Button` (`children`, `onClick`, `disabled`; `type="button"`). Every other part takes native props and children. There is no context and no state: the parts are layout, and the caller's field components own values, validation and errors. `removeLabel` is the finished name of the remove button ("Remove condition 2").

## Extension points

- `className` on every part.
- `Condition` takes any controls: a field `Select`, then operands per field (a `TagInput` for channels, a `Slider` for a duration, a `Switch` for unwatched).
- Rows are rendered by the caller from its array field, so adding, removing and reordering stay form operations.

## States

| State | What changes |
|---|---|
| no conditions | the list is left out; Add and Footer stay |
| at the limit | Add `disabled` |
| narrow | the controls inside a Condition wrap onto further lines, the remove button stays at the end |
| field error | the caller's `Field.Error` inside the Condition |

## Responsive behaviour

A single column at every width. Inside a Condition, controls keep their natural width and wrap; on compact each wraps to its own line as needed.

## Motion

None of its own. Rows the caller adds or removes may use the list's fade; reduced motion switches at once.

## Accessibility

- `Root` is a `fieldset` named by `aria-label`; `Conditions` is an ordered list, so a screen reader announces "item 2 of 3".
- Each Condition's controls carry names that include the condition's number; the remove button's name is `removeLabel`.
- Tab order follows the visual order: field, operands, remove, next row, Add, footer.

## Composition

Inside the smart playlist's create and edit form, in a dialog or a page section.

## Used by

web's /playlist page, ticket [119](../../../tickets/119-playlists-customisation-and-collaboration.md).

## Workbench stories

Three conditions (a channel picker, "under 10 minutes", "unwatched"); no conditions; at the limit; narrow; right-to-left.
