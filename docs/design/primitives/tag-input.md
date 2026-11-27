# TagInput

A list of short values typed into one field: blocked words, allowed sites. It is a [Chip](chip.md) per value over an [Input](input.md), with paste-a-list and duplicate handling, so a long list is entered the way people already write one.

## Anatomy

```
 Blocked words                                   1 the Field label
 ( spoiler x ) ( giveaway x ) ( follow me x )    2 one removable Chip per value
 [ Add a word and press Enter                 ]  3 the Input
 giveaway is already in the list                 4 the status line
```

| # | Part | Notes |
|---|---|---|
| 1 | Label | the surrounding [Field](field.md); the Input takes its id from it |
| 2 | Tags | `Chip` `outline`, the whole chip removes the value, labelled "Remove spoiler" |
| 3 | Input | the draft; it never holds a finished tag |
| 4 | Status | a `role="status"` `caption` in `fg-muted`, empty until a duplicate was dropped |

## API

```ts
interface TagInputProps extends Omit<InputProps, 'value' | 'defaultValue' | 'onChange' | 'type'> {
  value: readonly string[];
  onValueChange: (tags: string[]) => void;
  max?: number; // no more tags are taken once the list is this long
}
```

```tsx
<Field.Root>
  <Field.Label>Blocked words</Field.Label>
  <TagInput value={words} onValueChange={setWords} max={200} placeholder="Add a word and press Enter" />
</Field.Root>
```

Its words, "Remove {tag}" and "{tag} is already in the list", come from `useUiCopy()` (`tagRemove`, `tagDuplicate`).

## Behaviour

| Input | Result |
|---|---|
| Enter, or a comma or semicolon typed | the draft, trimmed, becomes a tag |
| Leaving the field | the draft becomes a tag |
| Pasting text with commas, semicolons, tabs or line breaks | one tag per piece, in order; nothing lands in the field |
| Pasting a single word | an ordinary paste into the draft |
| A tag already in the list, in any case | dropped; the status line names it until the next keystroke; the list keeps the first spelling |
| Backspace in an empty field | removes the last tag |
| A tag past `max` | dropped |

Entries are only trimmed and compared case-insensitively here. The rules for what a word or a host may be (length, shape) are the section's own and run in `@vp/validation` when it saves.

## Variants and sizes

None: the chips are `outline` and the input is the field's own size. A tag input in a table cell is not a use of it.

## States

| State | What changes |
|---|---|
| Empty | the input only, with its placeholder |
| With tags | the chips wrap above the input |
| Duplicate | the status line names the dropped value |
| At the limit | further tags are dropped; the caller says why in its own text |
| Disabled | the Input is disabled; the chips stay removable unless the caller disables the list |
| Focus | the Input's focus ring; each chip has its own |

## Tokens

Colour roles `fg-muted` for the status line plus those of Chip and Input; `spacing` `gap-inline`; type `caption`.

## Accessibility

- The Input is labelled by the Field; the chips are real buttons, each with an accessible name that says what it removes.
- The status line is a polite live region, so a dropped duplicate is announced without moving focus.
- Backspace removal is a convenience, never the only way: every chip is a button.

## Extension points

`className` on the root; every `Input` prop passes through (`placeholder`, `disabled`, `aria-describedby`).

## Do and don't

- Do use it for values the reader scans as a list and edits one by one.
- Do show the limit in the section's description when there is one.
- Don't use it for free text; use a [Textarea](textarea.md).
- Don't put a long sentence in a tag.

## In the workbench

Stories: empty, with tags, at its limit. Axes: themes by modes, RTL (the chips flow from the end), compact density, 320 px width.
