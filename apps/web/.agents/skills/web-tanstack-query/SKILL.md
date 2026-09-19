---
name: web-tanstack-query
description: TanStack Query v5 patterns, query keys, optimistic updates, and SSR hydration for Taitube web client.
---

# Web: TanStack Query v5 Patterns

Guide for data fetching, caching, mutations, and SSR hydration in `@vp/web`.

---

## 1. Query Keys Factory

Always use structured, hierarchical query key factories:

```typescript
export const videoKeys = {
  all: ['videos'] as const,
  lists: () => [...videoKeys.all, 'list'] as const,
  list: (filters: VideoFeedFilters) => [...videoKeys.lists(), filters] as const,
  details: () => [...videoKeys.all, 'detail'] as const,
  detail: (id: string) => [...videoKeys.details(), id] as const,
};
```

---

## 2. Query Hooks Encapsulation

Encapsulate every query inside a typed custom hook:

```typescript
export function useVideoDetail(videoId: string) {
  return useQuery({
    queryKey: videoKeys.detail(videoId),
    queryFn: () => apiClient.videos.getById(videoId),
    staleTime: 1000 * 60 * 5, // 5 minutes
    retry(failureCount, error) {
      if (isPermanentError(error)) return false;
      return failureCount < 3;
    },
  });
}
```

---

## 3. Mutations & Cache Invalidation

- Mutations must never auto-retry on server responses to guarantee side-effect idempotency.
- Optimistically update or invalidate query keys in `onSuccess`:

```typescript
export function useUpdateVideoMetadata() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: UpdateVideoArgs) => apiClient.videos.update(id, data),
    onSuccess: (updated) => {
      queryClient.setQueryData(videoKeys.detail(updated.id), updated);
      queryClient.invalidateQueries({ queryKey: videoKeys.lists() });
    },
  });
}
```
