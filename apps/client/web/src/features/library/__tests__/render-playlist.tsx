import { screen, within } from '@testing-library/react';
import type { HttpHandler } from 'msw/http';
import { libraryVideo, playlistDetail, uuid } from '#app/__tests__/library-fixtures';
import { renderLibrary } from './render-library';

export const LIST = uuid(4100);
export const VIDEOS = [
  libraryVideo(1, 'Tram ride'),
  libraryVideo(2, 'Old film'),
  libraryVideo(3, 'Night bus'),
];
export const ITEMS = [uuid(5000), uuid(5001), uuid(5002)];

/** The playlist page of `LIST`, owned by the viewer and holding `VIDEOS`, with `overrides` on the playlist and `handlers` first. */
export const renderPlaylist = (
  overrides: Parameters<typeof playlistDetail>[2] = {},
  handlers: HttpHandler[] = []
) =>
  renderLibrary(`/playlist?list=${LIST}`, {
    details: [playlistDetail(LIST, VIDEOS, { description: 'Slow ways home', ...overrides })],
    handlers,
  });

export const rowOf = async (title: string) => {
  const card = (await screen.findByRole('link', { name: title })).closest('article');
  if (!card) throw new Error(`no card around ${title}`);
  return within(card);
};

export const titles = () =>
  within(screen.getByRole('list', { name: 'Videos in Road trips' }))
    .getAllByRole('article')
    .map(
      (card) => within(card).getByRole('link', { name: /Tram ride|Old film|Night bus/ }).textContent
    );
