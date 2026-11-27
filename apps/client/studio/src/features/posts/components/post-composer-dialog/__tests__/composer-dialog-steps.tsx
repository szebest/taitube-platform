import { screen } from '@testing-library/react';
import type { renderPosts } from '#app/features/posts/__tests__/render-posts';

export type Rendered = Awaited<ReturnType<typeof renderPosts>>;

export async function openComposer({ user }: Rendered) {
  await user.click(screen.getByRole('button', { name: 'New post' }));
  return screen.findByRole('dialog', { name: 'New post' });
}

export const submit = (user: Rendered['user'], name: string) =>
  user.click(screen.getByRole('button', { name }));
