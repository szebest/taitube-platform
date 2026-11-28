# RoleEditor

Location: `apps/client/web/src/components/party/role-editor/`. Web's app kit, presentational and compound, built from `Checkbox`, `Input`, `AlertDialog`, `Badge`.

Edits the room's roles: name, colour and the permissions each holds, a preset to reset the built-in roles, and a new custom role. What the viewer may not touch stays on screen, disabled, with its reason.

## Anatomy

| Part | Notes |
|---|---|
| `List`, `Role` | one card per role: name, colour, member count, the permission checkboxes by group |
| `New` | a name field and Create |
| `Preset` | Friends or Public, behind a confirm |

## Props

```ts
interface RoleEditorRootProps { voice?: boolean; onUpdate; onDelete }
```

`voice` offers the voice permissions. Escalation is checked by `usePartyCan({ kind: 'grant', permission })`.

## States

| State | What changes |
|---|---|
| editable | checkboxes enabled |
| protected (Owner, Guest ceiling) | disabled, reason in text |
| escalation | the box is disabled with "You do not hold this" |
| saving | the row shows the change at once, the socket confirms |

## Responsive behaviour

A sheet or the panel's People tab; roles stack in one column.

## Accessibility

- Every checkbox has the permission's name; a disabled control keeps its reason in an accessible description. Deleting is an `AlertDialog`.

## Extension points

- `className` on every part, merged with `cn`.
- Copy comes from the `party` catalogue through `useT`, numbers and times through `useFormat`; logical properties only.

## Smart wrappers

| Wrapper | Folder (`features/...`) | Props | Hooks |
|---|---|---|---|
| `PartyRoleEditor` | `watch-party/components/` | `roomId` | `usePartyRoleEdits`, the room's roles |

## Used by

[140](../../../tickets/140-watch-parties.md) section 2.

## Workbench stories

All eleven built-in roles; custom role; protected rows; preset confirm; empty.
