# @kit/components

Compound components two apps share, built on `@kit/ui` primitives: `PageHeader`, `EmptyState`, `ErrorState`,
`SectionError`, `Shelf`, `StartHereShelf`, `VideoCard`, `VideoThumbnail`, `StatCard`, `LoginCard`, `AccountMenu`,
`DisclosureControl` and the state illustrations. Each is a `Root` plus parts that read one context; each ships its
styles as a `tv()` object so an app can compose them.

Install: `pnpm add @kit/components react`. It depends on `@kit/design-tokens` and `@kit/ui`.

Tokens: none. Every word a component prints, every link and every image arrives as a prop or a child, and the app
stylesheet names this package with `@source` so Tailwind sees its classes.

```tsx
import { EmptyState } from '@kit/components';

<EmptyState.Root>
  <EmptyState.Title>{copy.title}</EmptyState.Title>
  <EmptyState.Description>{copy.description}</EmptyState.Description>
</EmptyState.Root>;
```
