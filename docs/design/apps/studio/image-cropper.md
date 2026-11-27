# ImageCropper

The dialog where a creator frames a channel picture or banner before it is uploaded: the chosen file, a crop frame to drag and zoom, the safe-area guides, a live preview of each target and the processing job's progress. It lives in the studio's kit, `apps/client/studio/src/components/image/image-cropper/` ([README](README.md)). It is presentational: it holds the framing state and hands back the crop rectangles in whole pixels of the file; the upload, the decode of the file's size and the job's events belong to the smart wrapper.

## Anatomy

```
┌ Dialog ───────────────────────────────────────────────┐
│ 1 Frame your banner                                    │
│ 2 [ Desktop | Mobile | TV ]                            │
│ ┌───────────────────────────────────────────────────┐ │
│ │ 3 stage: the whole image, the crop frame lit, the  │ │
│ │   rest dimmed, the safe area dashed inside it       │ │
│ └───────────────────────────────────────────────────┘ │
│ 4 Zoom  ●────────────                                  │
│ 5 previews: desktop 6:1, mobile 3:1, TV 16:9           │
│ 6 status: ▬▬▬▬▬  Processing                            │
│ 7 [Cancel]                                [Use image]  │
└───────────────────────────────────────────────────────┘
```

| # | Part | Notes |
|---|---|---|
| 1 | `Title`, `Description` | `Dialog.Title` and `Dialog.Description`, words from the caller |
| 2 | `Targets` | `SegmentedControl` over the banner's targets; an avatar has one square target and renders nothing |
| 3 | `Stage` | the image at its own aspect ratio, the frame of the active target, the dimmed outside, the safe-area guide (banner only) |
| 4 | `Zoom` | `Slider`, 1x to 4x, per target |
| 5 | `Previews` | one box per target, drawn from the same local file with CSS `background-position` and `background-size`, no canvas |
| 6 | `Status` | `Progress` while the job runs, success or failure after it; nothing while editing |
| 7 | `Cancel`, `Confirm` | `Cancel` closes; `Confirm` hands the crops to `onConfirm` |

## Props

Plus the standard props.

```ts
// types.ts
import type { ChannelImageKind } from '@vp/validation';

export type ImageCropperKind = ChannelImageKind;
export type ImageCropperStatus = 'editing' | 'queued' | 'ready' | 'failed';
```

```ts
interface ImageCropperRootProps {
  kind: ImageCropperKind;
  src: string;                       // a local object URL, never a remote address
  size: { width: number; height: number }; // the decoded pixels of the file
  status?: ImageCropperStatus;       // default 'editing'
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (crops: ImageCrops) => void;  // ImageCrops from @vp/domain
}
interface ImageCropperStatusProps { label: string; }  // names the bar and is its visible text
// Parts: ImageCropper.Root, .Title, .Description, .Targets, .Stage, .Zoom, .Previews, .Status, .Cancel, .Confirm
```

`Root` is a `Dialog.Root` and `Dialog.Content` around its children, and holds each target's view (zoom and centre). `Targets` takes the segment labels as `labels`, `Stage`, `Zoom` and `Previews` take their accessible names as props: the kit prints no product word.

```tsx
<ImageCropper.Root kind="banner" src={url} size={size} open onOpenChange={setOpen} onConfirm={upload}>
  <ImageCropper.Title>Frame your banner</ImageCropper.Title>
  <ImageCropper.Targets labels={{ desktop: 'Desktop', mobile: 'Mobile', tv: 'TV' }} />
  <ImageCropper.Stage label="Crop area" />
  <ImageCropper.Zoom label="Zoom" />
  <ImageCropper.Previews labels={...} />
  <ImageCropper.Status label="Processing" />
  <ImageCropper.Cancel>Cancel</ImageCropper.Cancel>
  <ImageCropper.Confirm>Use image</ImageCropper.Confirm>
</ImageCropper.Root>
```

## The crop

Each target has a view: a zoom from 1 to 4 and a centre in pixels of the file. The crop rectangle is derived, never stored.

- At zoom 1 the frame is the largest rectangle of the target's aspect (`BANNER_ASPECTS` from `@vp/domain`: desktop 6, mobile 3, tv 16/9; the avatar 1) that fits the image; at zoom `z` its sides divide by `z`.
- The rectangle is whole pixels, clamped inside the image, so `decideImageCrops` (`@vp/domain-rules`), the rule the API runs on `complete`, accepts it. A spec runs the output through it.
- A drag moves the centre by the pointer's travel scaled from screen pixels to file pixels; the arrow keys move it by 5 percent of the frame, Shift by 25 percent. Zooming keeps the centre and re-clamps it.
- Banner targets frame the same upload independently: moving desktop leaves mobile and TV where they were.

The safe area is the centre 1546 x 423 of a 2560 x 1440 image. In a frame it is the same fractions of the frame's width and height (width 1546/2560; height 423 over the frame's height at 2560 wide), drawn dashed in `border-strong` over the lit frame. It marks what every screen shows.

## Variants

None: one look. The kind (`avatar` or `banner`) decides which targets, guides and previews exist, not the styling.

## States

| `status` and flags | What changes |
|---|---|
| `editing` | as drawn; the wrapper opens the cropper only for a file whose size it has decoded and which meets the kind's minimum |
| `queued` | the stage, targets, zoom and `Confirm` are disabled, `Status` shows an indeterminate `Progress` and its label |
| `ready` | `Status` shows a full bar and the label; the controls stay disabled and the caller relabels `Cancel` "Done" |
| `failed` | `Status` shows a danger `Callout` with the caller's message; the controls are enabled again and `Confirm` retries |
| dragging | the frame shows the grabbing cursor |
| zoom at its end | the slider thumb stops; nothing else changes |

## Skeleton

None: the dialog opens once the file is decoded, so the stage always has its image and its size.

## Responsive behaviour

| Breakpoint | Behaviour |
|---|---|
| compact | the dialog is full width, the previews stack under the stage |
| medium and up | the previews sit in a row under the stage; the dialog is `lg` |

The stage keeps the image's aspect ratio and never exceeds the dialog's height.

## Motion

The previews and the frame follow the pointer with no transition; the status bar uses `Progress`' own motion. Under reduced motion the indeterminate bar is static.

## Accessibility

- The frame is a focusable group named by `Stage`'s `label`; the arrow keys move it, so the crop is reachable without a pointer.
- `Targets` is a labelled radio group; `Zoom` is a labelled slider with its own keyboard.
- `Status` is a `role="status"` region; a failure is a `role="alert"`.
- The previews are `aria-hidden`: they repeat what the stage shows.
- Escape closes the dialog while editing; focus returns to the control that opened it.

## Composition

`Dialog`, `SegmentedControl`, `Slider`, `Progress`, `Callout`, `Button`. The file chooser stays outside: the smart wrapper uses `FileField` and the channel-image validators first, and opens the cropper with the decoded file.

## Smart wrappers

| Wrapper | Folder | Props | Hooks |
|---|---|---|---|
| `ImagesSection` | `features/channel/components/` | `channel: Channel` | `useChannelImageUpload` (prepare, PUT, complete, then the user events `channel.image.ready` and `channel.image.failed`), `useObjectUrl`, `useUpdateChannel` (remove), `useT` |

## Extension points

| Need | Point |
|---|---|
| A one-off tweak | `className` on any part |
| An extra region | any element inside `Root`, or a part reading `useImageCropper()` (kind, size, target, rects, status) |

## Used by

- [115, channel identity](../../../tickets/115-channel-page-customisation.md): the studio's Images section

## Workbench stories

- Avatar, banner at each target
- Banner, zoomed and moved
- Queued, ready, failed
- A narrow image and a tall image
- RTL
