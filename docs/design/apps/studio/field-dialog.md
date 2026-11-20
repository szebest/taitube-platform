# FieldDialog

A dialog that asks for the value of one field, a choice from a list or a line of text, and hands it back. It is the one dialog the library's bulk bar opens for every field it can change ([116](../../../tickets/116-video-management-power-tools.md)), so a new field adds a row to the caller's table and no new dialog. It lives in the studio's kit, `apps/client/studio/src/components/dialogs/field-dialog/` ([README](README.md)), and builds on `ResponsiveModal`, `Field`, `Select` and `Input`.

## Anatomy

```
 Change the visibility                           1 title
 Applies to 3 selected videos.                   2 description
 Visibility *                                    3 the field's label
 [ Public                              v ]       4 a Select, or an Input for text
 Separate tags with commas.                      5 hint (text only)
                         ( Cancel )  ( Apply )   6 footer
```

| # | Part | Notes |
|---|---|---|
| 1, 2 | Header | `ResponsiveModal.Title` and an optional `Description`, both from the caller |
| 3, 4, 5 | Field | one `Field.Root`; a `Select` for a choice, an `Input` and an optional `Field.Hint` for text |
| 6 | Footer | `Cancel` from the kit's copy, and the caller's submit label |

## Props

```ts
interface FieldDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  label: string;
  input: FieldInput;
  submitLabel: string;
  onSubmit: (value: string) => void; // the trimmed value
  pending?: boolean;
}
type FieldInput =
  | { kind: 'choice'; options: readonly { value: string; label: string }[]; initial?: string }
  | { kind: 'text'; hint?: string };
```

Every word arrives through props. The value is held in the dialog and starts again each time it opens; a choice starts on `initial` or its first option, and a text value starts empty.

## Smart wrapper

| Wrapper | Feature folder | Props | Hooks |
|---|---|---|---|
| `LibraryFieldDialog` | `features/videos/components/` | `open`, `onOpenChange`, `field`, `count`, `onApply(patch)` | `useQuery(categoriesQueryOptions)` for the category choice |

It maps each bulk field to its title, label and input, and turns the submitted value into the patch with `buildBulkPatch`.

## States

| State | What changes |
|---|---|
| Blank text | the submit button is disabled |
| Pending | the submit button shows its spinner |
| Closed | nothing is on the page |

## Accessibility

A dialog named by its title and described by its description; the field has a visible label; Enter in the text field submits; Escape and Cancel close it without submitting.

## In the workbench

Stories: choice, text, pending. Axes: themes by modes, RTL, 320 px width.
