# Primitives

The catalogue of `@vp/ui` primitives that [ticket 95](../../tickets/95-design-system-2.md) builds: 22 that exist today, rebuilt on the token sets, and 19 new ones. Each has a spec in this folder; the design language they implement is [../README.md](../README.md) and the values are in [../tokens.json](../tokens.json). Components built from them are in [../components/](../components/README.md) (shared by both apps) and each app's kit ([../apps/web/](../apps/web/README.md), [../apps/studio/](../apps/studio/README.md)).

## The catalogue

| Primitive | Purpose | Radix base | Status |
|---|---|---|---|
| [Avatar](avatar.md) | A person or channel as a picture with a monogram fallback | Avatar | existing-rebuilt |
| [Badge](badge.md) | A small static classification label (4K, NEW, LIVE) | none | existing-rebuilt |
| [Button](button.md) | The one control for an action | Slot | existing-rebuilt |
| [IconButton](icon-button.md) | A button with only an icon and a required name | Slot | new |
| [Card](card.md) | A bordered surface that groups content | Slot | existing-rebuilt |
| [Checkbox](checkbox.md) | A binary or tri-state choice applied with a form | Checkbox | existing-rebuilt |
| [Dialog](dialog.md) | A modal task or decision, and the edge Sheet | Dialog, AlertDialog | existing-rebuilt (absorbs Sheet) |
| [Drawer](drawer.md) | A draggable sheet from the bottom edge on compact | Dialog | new |
| [DropdownMenu](dropdown-menu.md) | Actions opened from a button | DropdownMenu | existing-rebuilt |
| [ContextMenu](context-menu.md) | The same menu opened by right-click or long-press | ContextMenu | new |
| [Popover](popover.md) | A floating panel of interactive content | Popover | new |
| [HoverCard](hover-card.md) | A read-only preview on hover | HoverCard | new |
| [Tooltip](tooltip.md) | A short non-interactive label | Tooltip | existing-rebuilt |
| [Command](command.md) | A filterable list: palette and combobox base | none (cmdk) | new |
| [Field](field.md) | Ties a control to its label, hint and error | Label | existing-rebuilt |
| [Input](input.md) | A single-line text field | none | existing-rebuilt |
| [Textarea](textarea.md) | A multi-line text field | none | existing-rebuilt |
| [Select](select.md) | Choose one value from a closed list | Select | existing-rebuilt |
| [Label](label.md) | The clickable name of a control | Label | existing-rebuilt |
| [Switch](switch.md) | An on or off setting that applies at once | Switch | existing-rebuilt |
| [Slider](slider.md) | A draggable value or range; the seek and volume base | Slider | new |
| [ToggleGroup](toggle-group.md) | Related buttons that toggle, single or multiple | ToggleGroup | new |
| [SegmentedControl](segmented-control.md) | Exactly one of two to five options, joined | RadioGroup | new |
| [Tabs](tabs.md) | Peer views, one visible at a time | Tabs | existing-rebuilt |
| [Chip](chip.md) (`Chip.Root`, `Chip.Remove`, `ChipGroup`) | A pill toggle or link for filters and tags | ToggleGroup (group) | new |
| [Progress](progress.md) | How far a task or video has got | Progress | existing-rebuilt |
| [Skeleton](skeleton.md) | A placeholder at the loaded layout's dimensions | none | existing-rebuilt |
| [Table](table.md) | Semantic table parts with density, dividers and states; no data state | none | new |
| [SortableList](sortable-list.md) | Reorder a list by pointer or keyboard, every move announced | none (built on `@dnd-kit/sortable`, imported only here) | new |
| [Spinner](spinner.md) | An indeterminate wait | none | existing-rebuilt |
| [Separator](separator.md) | A thin dividing line | Separator | existing-rebuilt |
| [ScrollArea](scroll-area.md) | A scrollable region with a themed bar and fades | ScrollArea | new |
| [Toast](toast.md) | A transient message after something happened | Toast | existing-rebuilt |
| [Callout](callout.md) | A persistent inline message in the page flow | none | new |
| [Kbd](kbd.md) | A keycap for a shortcut | none | new |
| [Icon](icon.md) | A sized Lucide glyph | none | new |
| [AspectRatio](aspect-ratio.md) | A box that reserves a media ratio | AspectRatio | new |
| [VisuallyHidden](visually-hidden.md) | Text for assistive technology only | VisuallyHidden | new |
| [UiCopyProvider](ui-copy-provider.md) | Supplies the built-in control strings from the app's catalogue | none | new |
| [Logo](logo.md) | The mark and wordmark | none | existing-rebuilt (was `BrandLogo`) |

`Sheet` has no file of its own: it is `Dialog.Content` with `side="inline-start"` or `"inline-end"`, and its bottom form is `Drawer`.

## Primitive or component

A thing is a **primitive** in `@vp/ui` when all of these hold; otherwise it is a component, in `@vp/components` when
both apps render it and in an app's kit when one does ([architecture section 1](../architecture.md#1-five-layers);
specs in [../components/](../components/README.md), [../apps/web/](../apps/web/README.md) and
[../apps/studio/](../apps/studio/README.md)):

1. It knows no product concept: no video, channel, queue, route or user. It takes display values and children.
2. It has no data of its own: no fetching, no formatting of dates or numbers, and its own strings come from
   `useUiCopy()`.
3. It is one control or surface that several components reuse; a second component wanting the same thing is the signal to extract it.
4. Its look comes only from the token sets (colour roles, sizing, spacing, border, radius, type, shadow and motion), never from a layout of other primitives.

If it composes two or more primitives into an arrangement (a card with a thumbnail, byline and reason; a shelf; a palette over `Command`), it is a component. If it needs a Radix or headless base for behaviour, that is a primitive. When in doubt, build it as a component first and extract the primitive when a second use appears.

## The API shape

- **Compound components are the pattern.** A primitive with more than one region exposes parts (`Dialog.Root`, `.Trigger`, `.Content`, `.Title`, `.Description`, `.Footer`, `.Close`; `Field.Root`, `.Label`, `.Control`, `.Hint`, `.Error`; `Card.Root`, `.Header`, `.Body`, `.Footer`; `Tabs.Root`, `.List`, `.Tab`, `.Panel`; `Table.Root`, `.Header`, `.Row`, `.Cell`). Every compound root is `X.Root`, as in Radix. A slot is a child, not a content prop: `<Dialog.Title>`, never `title="..."`.
- **The root keeps only whole-component options** (`variant`, `size`, `open` and `onOpenChange`) and shares them with its parts through context, created with `createCompoundContext(name)`; a part outside its root throws a named error.
- **Single-element primitives stay one component** with native props: Button, IconButton, Badge, Kbd, Input, Textarea, Switch, Checkbox, Label, Progress, Skeleton, Spinner, Separator, Icon, Logo, AspectRatio, ScrollArea.
- **Extend, do not re-list.** A spec's props interface extends the native element's props (`ComponentPropsWithRef<'button'>`) or the Radix part's, and lists only the props a caller sets itself, typically two to five per part.
- **Every part takes `className` and `ref`; single-element parts take `asChild`.** Specs mention only deviations.
- **Variant vocabulary is fixed**: `variant` (a fill), `size`, `tone` (a colour intent), `shape`, and only those a component really has. No boolean that repeats a variant.
- **Shared unions only.** A prop's string union is one of the shared option unions ([architecture section 3](../architecture.md#3-shared-option-unions)): from `@vp/design-tokens` (`SizeOption`, `ControlSize`, `IconSize`, `RadiusOption`, `ElevationOption`, `TypeStyleOption`, `SpaceStep`, `ColorRole`, `ToneOption`, `ModeOption`, `ContrastOption`, `TokenGroup`) or from `@vp/ui` types (`FillOption`, `ShapeOption`, `Orientation`, `Align`, `Side`). A component narrows with `Extract` and `Exclude` in its own `types.ts` (`Pick` and `Omit` are for object keys), and widens with `| 'x'` only for a value nothing shared names. A props interface never spells a literal union inline; each spec's API section shows its `types.ts` first, then the props built from those aliases. `variant` is a `FillOption` subset and `tone` a `ToneOption` subset; `side` is `Side` (logical, mapped to Radix's physical sides by direction) and `orientation` is `Orientation`.
- **Open for extension.** Every compound primitive has the same extension points ([architecture section 4](../architecture.md#4-how-a-component-is-shaped)): `className` on every part, `asChild` on the parts that render one element, an exported context hook (`useDialog()`) so an app can write a part that reads the root's state, and the exported `tv()` styles (`dialogStyles`) for `tv({ extend })`. Each compound spec lists them under Extension points.
- **No copy in primitives, and no per-instance label props.** `@vp/ui` is T2 and cannot import `@vp/messages` (T3). Built-in strings (a close button's label, the required and optional marks, a Command empty line) come from a typed `UiCopy` that each app provides once through [`UiCopyProvider`](ui-copy-provider.md), filled from its `@vp/messages` catalogue, and that components read with `useUiCopy()`. Names the caller supplies (a title, an `aria-label`, hidden text) are ordinary children or native props, translated by the app.
- **Logical properties only** (`padding-inline`, `inset-inline-start`, `text-align: start`), so RTL needs no component change.
- **Roles, never values.** Specs name `tokens.json` roles: colour roles (`surface`, `accent`, `focus-ring`), `sizing` (control sm, md, lg heights, icon and avatar sizes, `touch-target`), `spacing` roles (`inset-control`, `inset-card`, `gap-inline`, `gap-stack`, `gap-grid-x`, `gap-grid-y`, `gap-shelf`, `section`, `gutter-*`), `border` widths (`divider`, `control`, `focus`, `focus-offset`), radius roles (`control`, `chip`, `card`, `sheet`, `thumb`, `xs`, `sm`), type styles, `shadow` elevation 1 to 3 and `motion` durations and easings. Each spec's Tokens section says which set a value comes from. A pixel value appears only where no token covers it (a panel width, a bar thickness) and is marked as a component measure.
- **One focus ring**: the `focus-ring` role, `border.focus` wide with `border.focus-offset`, drawn with `outline`.
- **Disabled** is the `tint` ground and `fg-subtle` text; never an opacity trick. Under a coarse pointer every control's hit area is at least `sizing.layout.touch-target`.

## The workbench

Each spec ends with the stories it must have. A component is done when the workbench renders each story in Sand and Nocturne, each in dark, light and OLED, plus compact density, RTL and more contrast where the component has text, and axe reports nothing.

## Where today's code and the target differ

Today's primitives live in `packages/client/ui/src/*.tsx` with flat exports (`DialogContent`, `TabsTrigger`) and use classes that are not roles (`bg-popover`, `bg-overlay`, `bg-surface-elevated`, `danger-solid`). The specs describe the target; each file names its renames where it matters.
