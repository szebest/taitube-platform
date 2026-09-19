---
name: web-headless-ui
description: Headless UI patterns, custom hooks separation, zero logic in JSX, and URL-driven state for Taitube web client.
---

# Web: Headless UI & URL-Driven State Patterns

Guide for authoring clean, presentational React components separated from business and stateful logic.

---

## 1. Zero Business Logic in Components

Components MUST NOT contain inline API calls, permission checks, or complex formatting algorithms:

```tsx
// ❌ FORBIDDEN: Business logic and permission check embedded in component
export function VideoCard({ video }: { video: VideoDto }) {
  const user = useAuthUser();
  const canEdit = user?.role === 'admin' || user?.id === video.ownerId;
  const formattedViews = Intl.NumberFormat().format(video.viewsCount);

  return (
    <div>
      <h3>{video.title}</h3>
      <span>{formattedViews} views</span>
      {canEdit && <button onClick={() => edit(video.id)}>Edit</button>}
    </div>
  );
}

// ✅ CORRECT: Pure presentational component consuming custom hook
export function VideoCard({ video }: { video: VideoDto }) {
  const { formattedViews, canEdit, onEdit } = useVideoCard(video);

  return (
    <div>
      <h3>{video.title}</h3>
      <span>{formattedViews} views</span>
      {canEdit && <button onClick={onEdit}>Edit</button>}
    </div>
  );
}
```

---

## 2. URL-Driven State (STS Pattern)

Sync all modal, tab, and filter state with TanStack Router search params:

```typescript
// Define schema in route definition
export const Route = createFileRoute('/watch/$videoId')({
  validateSearch: z.object({
    modal: z.enum(['share', 'playlist', 'report']).optional(),
    t: z.coerce.number().optional(),
  }),
});

// Access via hook in custom hooks
export function useWatchModal() {
  const { modal } = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });

  const openModal = (type: 'share' | 'playlist' | 'report') => {
    navigate({ search: (prev) => ({ ...prev, modal: type }), replace: false });
  };

  const closeModal = () => {
    navigate({ search: (prev) => ({ ...prev, modal: undefined }), replace: false });
  };

  return { activeModal: modal, openModal, closeModal };
}
```
