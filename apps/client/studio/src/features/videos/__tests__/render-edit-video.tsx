import userEvent from '@testing-library/user-event';
import type { Video } from '@vp/api-contracts';
import { VIDEO_ID, video } from '@vp/web-testing';
import { renderRoute } from '@vp/web-testing/dom';
import { signInBrowser } from '#app/__tests__/providers';
import { getRouter } from '#app/router';
import { servePipeline } from './video-pipeline-api.fixture';

const SPRITE = {
  url: 'http://localhost:9000/sprites/s.jpg',
  intervalSec: 10,
  columns: 10,
  tileWidth: 160,
  tileHeight: 90,
};

/** The editor opened on its Edit video tab over `servePipeline`, for every spec of the tab. */
export async function renderEditVideo(
  options: Parameters<typeof servePipeline>[1] = {},
  patch: Partial<Video> = {}
) {
  const user = userEvent.setup();
  const served = servePipeline(
    video({ durationMs: 120_000, version: 4, sprite: SPRITE, ...patch }),
    options
  );
  await renderRoute(getRouter, `/videos/${VIDEO_ID}/edit?tab=edit`, {
    handlers: [signInBrowser()],
  });
  return { ...served, user };
}
