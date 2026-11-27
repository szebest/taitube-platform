# CustomizationSection

One block of a settings page with its own save: a card that is a form, with a header, a body and a footer that says what the last save came to. `/customization` builds its channel sections from it and `/comments/settings` builds its comment sections the same way. It lives in the studio's kit, `apps/client/studio/src/components/section/customization-section/` ([README](README.md)).

## Anatomy

| Part | Notes |
|---|---|
| `CustomizationSection.Root` | a `Card` that is a `form`, named by its title |
| `.Header`, `.Title`, `.Description` | the card header; the title is an `h2` |
| `.Body` | the fields, `gap-stack` |
| `.Footer` | `saving`, `saved`, `failure`, `disabled`: the status line (`role="status"`, or `alert` on a failure) and the Save button, which is disabled until something changed |

## Rules

- Each section saves alone and never submits another section's fields.
- A section that changes records in place (a list with Remove or Lift) has no footer and uses the plain `Card` parts.
- The status line is the only place a save's outcome is written; a failure names the section, not the cause.

## In the workbench

Stories: idle, saving, saved, failed.
