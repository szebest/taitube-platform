# AccessGate

Location: `apps/client/web/src/components/watch/access-gate/`. Web's app kit, presentational and compound, built on
[EmptyState](../../components/empty-state.md) from `@kit/components` and `Field`, `Input`, `Button` and `Icon` from
`@kit/ui`. Studio never shows it: a creator reads their own video without a gate.

What stands in for a video the viewer may not watch yet ([116](../../../tickets/116-video-management-power-tools.md)
section 5): the reason, and the one way on. It replaces the whole watch page, or fills an embed's frame.

## Anatomy

```
 ┌──────────────────────────────────────────────┐
 │                  1 (lock)                    │
 │        2 This video is protected             │
 │  3 Enter the password its creator gave you.  │
 │  4 Password  [••••••••••••            ]      │
 │    ! That password is not right.             │
 │  5 [               Watch               ]     │
 └──────────────────────────────────────────────┘
```

| # | Region | Notes |
|---|---|---|
| 1 | Icon | `lock` for a password, `clock` for a share link that stopped working; `fg-muted`, `icon.lg`, decorative |
| 2 | Title | the page's `h1`, `title-lg` |
| 3 | Description | `body`, `fg-muted`; left out in an embed, where the frame is small |
| 4 | Password field | `Field` with `Input type="password"`, `autocomplete="current-password"`; the refusal is the field's `Field.Error`, so the field's description reads it out |
| 5 | Action | the form's submit (`loading` while the attempt is on its way), or one `AccessGate.Action` link: home after an expired link, the watch page in a new tab from an embed |

## Props

```ts
// types.ts
export type AccessGateIcon = Extract<IconId, 'lock' | 'clock'>;
export type AccessGateSize = Extract<EmptyStateSize, 'page' | 'section'>;
```

```ts
interface AccessGateRootProps { icon: AccessGateIcon; size?: AccessGateSize } // size default 'page'
interface AccessGatePasswordFormProps {
  label: string;
  submitLabel: string;
  error?: string;     // the refusal, in the viewer's words (ERROR_COPY of the code)
  pending?: boolean;
  onUnlock: (password: string) => void;
}
// Parts: AccessGate.Root, .Title, .Description, .PasswordForm, .Action
```

The form is `method="post"`, so a submit before hydration never puts the password in a URL. An empty field submits
nothing. The words come from the wrapper (`WatchPasswordGate`, `ShareLinkExpired`, `EmbedAccessGate`) through `useT`.

## States

| State | Story |
|---|---|
| Locked | `Locked` |
| Wrong password (403 `VIDEO_PASSWORD_INVALID`) | `WrongPassword` |
| Too many attempts (429) | `RateLimited` |
| Unlocking | `Unlocking` |
| Share link expired or revoked (410) | `LinkExpired` |
| Locked in an embed, linking out | `InAnEmbed` |

## Skeleton

None: the gate is what the loader answers, so it never waits on its own data.

## Variants

| `size` | Layout |
|---|---|
| `page` | centred like EmptyState `page`, `max-w-prose`, the form full width under the copy |
| `section` | EmptyState `section` padding, for an embed's frame from 320 px wide |
