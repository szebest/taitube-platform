# SecretReveal

A secret the API returns once, shown once: a warning that it will not be shown again, the value in full with Copy, and a
Done that stays disabled until the creator ticks that they saved it. The developer page uses it for a new personal access
token and for a new webhook's signing secret. It lives in the studio's kit,
`apps/client/studio/src/components/developers/secret-reveal/` ([README](README.md)).

## Anatomy

```
 ┌ ! This is the only time the token is shown. ──────────────┐   1 Notice
 └───────────────────────────────────────────────────────────┘
 Token for Nightly sync                                          2 Label
 ┌──────────────────────────────────────────────┐ ┌──────┐
 │ tt_pat_0a1b2c3d_5f0e4b2a9c8d7e6f…            │ │ Copy │       3 Value, 4 Copy
 └──────────────────────────────────────────────┘ └──────┘
 [ ] I saved this token somewhere safe                           5 Acknowledge
                                                    ┌──────┐
                                                    │ Done │     6 Done
                                                    └──────┘
```

| # | Part | Notes |
|---|---|---|
| 1 | `SecretReveal.Notice` | a `warning` `Callout` with `role="status"`; forwards its props, so a dialog can make it its description through `asChild` |
| 2 | `.Label` | names the value; the value's `aria-labelledby` |
| 3 | `.Value` | a read-only `Input` in the mono face, never masked, all of it selected on focus |
| 4 | `.Copy` | an outline `Button`; `onCopy(value)` goes to the caller, and the label turns from `copy` to `copied` (`useUiCopy()`) once pressed |
| 5 | `.Acknowledge` | a `Checkbox` with the caller's words; the only thing that opens the gate |
| 6 | `.Done` | a solid accent `Button`, disabled until Acknowledge is ticked; the caller closes what showed the secret |

## Props

```ts
interface SecretRevealRootProps extends ComponentPropsWithRef<'div'> {
  value: string;
}

interface SecretRevealCopyProps extends Omit<ButtonProps, 'onClick' | 'onCopy' | 'asChild'> {
  onCopy: (value: string) => void;
}
```

```tsx
<SecretReveal.Root value={created.token}>
  <SecretReveal.Notice>{notice}</SecretReveal.Notice>
  <SecretReveal.Label>{label}</SecretReveal.Label>
  <SecretReveal.Value />
  <SecretReveal.Copy onCopy={(value) => copy(label, value)} />
  <SecretReveal.Acknowledge>{saved}</SecretReveal.Acknowledge>
  <SecretReveal.Done onClick={onClose}>{done}</SecretReveal.Done>
</SecretReveal.Root>
```

Copied and acknowledged are the part's own visual state; nothing outside needs to restore them, because the secret is
gone once the caller closes.

## Extension points

`className` on every part, the props of `Button` on Copy and Done, the props of `Callout.Root` on Notice, and
`useSecretReveal()` for a part of the caller's own that reads the value or the gate.

## States

| State | What changes |
|---|---|
| Fresh | Copy says Copy, Done is disabled |
| Copied | Copy says Copied |
| Acknowledged | the box is ticked and Done is enabled |

## Behaviour

- While the secret shows, the dialog around it does not close on Escape or outside a click: Done is the way out, so the
  secret cannot be lost by a stray key. The create dialogs of the developer page hold this by ignoring `onOpenChange`
  until Done.
- The page keeps the secret only in the dialog's state; closing it drops the value and no query caches it.

## Responsive behaviour

Value and Copy share a row and the value takes what is left; in a drawer on compact the row stays, the value scrolls
inside its field.

## Accessibility

- The notice is the dialog's description, so it is read with the title.
- Copy's name contains its visible word; the value is a labelled text box a screen reader can read in full.
- Done's disabled state is announced; ticking the box is the one step before it.

## Used by

- Studio: [118](../../../tickets/118-creator-data-portability-and-api.md), the token and webhook create dialogs of `/developers`

## Workbench stories

- Fresh (a token)
- Webhook secret
