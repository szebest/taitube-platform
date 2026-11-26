# RevisionList

The saved versions of one record, newest first, each with the fields it changed and a way back to it. It is the body of the video editor's History tab ([116](../../../tickets/116-video-management-power-tools.md)) and lives in the studio's kit, `apps/client/studio/src/components/history/revision-list/` ([README](README.md)); web has no history surface.

## Anatomy

```
 Version 5  [Current]  2 hours ago
   title and chapters
 Version 4                1 day ago                         [ Restore version 4 ]
   No field differs from the version before it
 Version 1                3 days ago                        [ Restore version 1 ]
   Before the first edit
```

| Part | Notes |
|---|---|
| Version | `Version n`, a `Badge` when it is the current one, and the time as a `<time>` |
| Restored from | `Restored from version n` when the revision is a restore; the API stores the number, the label comes from the catalogue |
| What changed | the fields that differ from the version before it, listed; `null` for the oldest loaded one reads "Before the first edit" |
| Restore | an `outline` small `Button`; absent on the current version |

## Props

```ts
interface RevisionListItem {
  id: string;
  version: number;
  createdAt: string;
  restoredFromVersion: number | null; // the version a restore went back to
  changedFields: VideoMetadataField[] | null; // from diffSnapshots against the older version
  current: boolean;
}
interface RevisionListProps extends ComponentPropsWithRef<'ol'> {
  items: readonly RevisionListItem[];
  onRestore: (item: RevisionListItem) => void;
  pending?: boolean; // every restore waits while one runs
}
```

The list is an ordered list: name it with `aria-label`.

## Smart wrapper

| Wrapper | Feature folder | Props | Hooks |
|---|---|---|---|
| `HistoryPanel` | `features/videos/components/` | `video` | `useInfiniteQuery(revisionsQueryOptions)`, `useMutation(restoreRevisionMutationOptions)`, `useToast` |

It computes `changedFields` with `diffSnapshots` over neighbouring revisions, restores under the video's current `version`, and opens the shared `VersionConflictDialog` on a 409 (reload, or overwrite on the newest version). Load more pages the keyset.

## States

| State | What changes |
|---|---|
| Idle | every restore enabled |
| Pending | every restore disabled |
| Current version | no restore button |

## Accessibility

A list with a name; each restore button names its version; the time is a real `<time>`; nothing relies on colour.
