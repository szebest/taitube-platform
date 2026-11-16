# ScopePicker

The scopes a personal access token may carry, as checkboxes grouped by what they touch, each item worded for the creator
with the scope's own name under it. It lives in the studio's kit,
`apps/client/studio/src/components/developers/scope-picker/` ([README](README.md)).

## Anatomy

```
 Scopes                                                    1 Legend
 Videos                         Analytics                  2 Group, GroupTitle
 [x] Read videos and details    [ ] Read views and watch time
     videos:read                    analytics:read         3 Item: the label, then the scope
 [ ] Edit details, chapters...
     videos:write
```

| # | Part | Notes |
|---|---|---|
| 1 | `ScopePicker.Root`, `.Legend` | a `fieldset` and its `legend`; `disabled` reaches every checkbox |
| 2 | `.Group`, `.GroupTitle` | `role="group"` named by its title |
| 3 | `.Item` | a `Checkbox` named by the caller's words and described by the scope in the mono face |

## Props

```ts
interface ScopePickerRootProps extends Omit<ComponentPropsWithRef<'fieldset'>, 'onChange' | 'defaultValue'> {
  value: readonly ApiScope[];
  onValueChange: (value: ApiScope[]) => void;
}

interface ScopePickerItemProps {
  scope: ApiScope;
  children: string;
}
```

`ApiScope` is the union of `API_SCOPES` in `@vp/domain`. The value is controlled: the dialog owns the draft and sends it.
The groups and their order are the caller's (the developer page's `TokenScopePicker` writes them), so a new scope is one
item there and one key in the catalogue.

## Extension points

`className` on Root, Legend, Group and GroupTitle, and `useScopePicker()` for an item of the caller's own.

## States

| State | What changes |
|---|---|
| None chosen | every box empty; the caller says a scope is required on submit |
| Some chosen | the chosen boxes ticked |
| Disabled | the fieldset disabled while the token is created |

## Responsive behaviour

The caller lays the groups out; the developer page puts them in two columns from the medium breakpoint and one below it.
Each item is a 44 px target through the checkbox and its label.

## Accessibility

- A `fieldset` with a `legend`, then one named group per area, so a screen reader hears "Videos, group" before its items.
- The scope name is the item's description, never its name, so the name stays the creator's words.

## Used by

- Studio: [118](../../../tickets/118-creator-data-portability-and-api.md), the create token dialog of `/developers`

## Workbench stories

- Empty
- Some chosen
- Disabled
