import { screen, waitFor, within } from '@testing-library/react';
import type { UserEvent } from '@testing-library/user-event';
import {
  abortUpload,
  completeUpload,
  getVideo,
  listCategories,
  startUpload,
} from '@vp/api-contracts';
import { ErrorCodes } from '@vp/errors';
import { VIDEO_ID, apiServer, mockEndpoint, problemReply, video } from '@vp/web-testing';
import { renderRoute } from '@vp/web-testing/dom';
import axios from 'axios';
import { HttpResponse } from 'msw/http';

import { signInBrowser } from '#app/__tests__/providers';
import { serveLibrary } from '#app/features/content/__tests__/library-api.fixture';
import { getRouter } from '#app/router';

export const UPLOAD_ID = '0190c3a0-5e1d-7000-8000-00000000e001';

export const CLIP = new File(['abcdefgh'], 'clip.mp4', { type: 'video/mp4' });

/**
 * The API and the storage of one upload. The storage holds the PUT until `finishTransfer`, after
 * reporting `halfway` bytes, so a spec can look at the widget while the file is in flight.
 */
export function serveUpload({ startRefused = false } = {}) {
  const aborts: string[] = [];
  const started: unknown[] = [];
  const transfers: { finish: () => void; fail: () => void }[] = [];

  apiServer.use(
    mockEndpoint(startUpload, async ({ request }) => {
      started.push(await request.json());
      if (startRefused) return problemReply(ErrorCodes.QUOTA_EXCEEDED);
      return HttpResponse.json(
        {
          videoId: VIDEO_ID,
          uploadId: UPLOAD_ID,
          strategy: 'single',
          singleUrl: 'http://localhost:9000/raw/source.mp4',
          expiresAt: '2026-01-01T01:00:00.000Z',
        },
        { status: 201 }
      );
    }),
    mockEndpoint(completeUpload, () =>
      HttpResponse.json({ videoId: VIDEO_ID, status: 'UPLOADED' }, { status: 202 })
    ),
    mockEndpoint(abortUpload, ({ params }) => {
      aborts.push(String(params['uploadId']));
      return new HttpResponse(null, { status: 204 });
    }),
    mockEndpoint(getVideo, () => HttpResponse.json(video({ status: 'UPLOADED' }))),
    mockEndpoint(listCategories, () => HttpResponse.json([]))
  );

  vi.spyOn(axios, 'put').mockImplementation(
    (_url, body, config) =>
      new Promise((resolve, reject) => {
        const { size } = body as Blob;
        config?.onUploadProgress?.({
          loaded: size / 2,
          total: size,
          progress: 0.5,
          bytes: size / 2,
          lengthComputable: true,
        });
        config?.signal?.addEventListener?.('abort', () => reject(new axios.CanceledError()));
        transfers.push({
          finish: () => resolve({ headers: {} }),
          fail: () => reject(new Error('storage refused the file')),
        });
      })
  );

  return {
    started,
    aborts,
    finishTransfer: () => transfers.at(-1)?.finish(),
    failTransfer: () => transfers.at(-1)?.fail(),
  };
}

/** The studio on its library with nobody's videos, signed in as a creator. */
export async function renderStudio() {
  serveLibrary([{ cursor: null, items: [], next: null }]);
  const rendered = await renderRoute(getRouter, '/videos', { handlers: [signInBrowser()] });
  await screen.findByRole('banner');
  return rendered;
}

/** Opens the dialog from the toolbar, picks `CLIP`, names it and presses upload. */
export async function uploadClip(user: UserEvent, title: string) {
  await user.click(within(screen.getByRole('banner')).getByRole('button', { name: 'Upload' }));
  const dialog = await screen.findByRole('dialog', { name: 'Upload a video' });
  await user.upload(dialog.querySelector('input[type="file"]') as HTMLInputElement, CLIP);
  await user.type(within(dialog).getByRole('textbox', { name: 'Video title' }), title);
  await user.click(within(dialog).getByRole('button', { name: 'Upload' }));
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
}
