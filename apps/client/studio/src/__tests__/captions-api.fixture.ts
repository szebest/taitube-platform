import {
  type CaptionListView,
  PROBLEM_CONTENT_TYPE,
  deleteCaptionTrack,
  editCaptionCues,
  generateCaptions,
  getTranscript,
  listCaptions,
  problemDetails,
  updateCaptionSettings,
  uploadCaptionTrack,
} from '@vp/api-contracts';
import { ErrorCodes } from '@vp/errors';
import { captionTrack, mockEndpoint, problemReply, transcript } from '@vp/web-testing';
import { HttpResponse } from 'msw/http';

export const BROKEN_VTT = 'WEBVTT\n\nnot a timing line\nhello\n';

type Track = ReturnType<typeof captionTrack>;

interface CaptionsApi {
  tracks: Track[];
  autoCaptions: boolean | null;
  channelDefault: boolean;
  cues: ReturnType<typeof transcript>['cues'];
}

const listOf = (state: CaptionsApi): CaptionListView => ({
  tracks: state.tracks,
  settings: { autoCaptions: state.autoCaptions, channelDefault: state.channelDefault },
});

/**
 * The captions API of one video, stateful: `state` is what the server holds, so a spec changes it to
 * stand for a worker finishing a track, and the bodies each write received come back for assertions.
 */
export function serveCaptions(initial: Partial<CaptionsApi> = {}) {
  const state: CaptionsApi = {
    tracks: [],
    autoCaptions: null,
    channelDefault: false,
    cues: transcript().cues,
    ...initial,
  };
  const writes = {
    settings: [] as unknown[],
    cues: [] as unknown[],
    uploads: [] as unknown[],
    generates: [] as unknown[],
    deletes: [] as string[],
  };
  const replace = (track: Track) => {
    state.tracks = state.tracks.map((held) => (held.id === track.id ? track : held));
    return track;
  };

  const handlers = [
    mockEndpoint(listCaptions, () => HttpResponse.json(listOf(state))),
    mockEndpoint(getTranscript, () =>
      HttpResponse.json({ ...transcript(), language: 'en', cues: state.cues })
    ),
    mockEndpoint(updateCaptionSettings, async ({ request }) => {
      const body = await request.json();
      writes.settings.push(body);
      state.autoCaptions = body.autoCaptions;
      const generated = state.tracks.some(({ kind }) => kind !== 'uploaded');
      if (body.autoCaptions === true && !generated) {
        state.tracks = [...state.tracks, captionTrack({ status: 'pending', url: null })];
      }
      return HttpResponse.json(listOf(state));
    }),
    mockEndpoint(editCaptionCues, async ({ request, params }) => {
      const body = await request.json();
      writes.cues.push(body);
      const held = state.tracks.find(({ language }) => language === params['lang']);
      if (held === undefined || held.version !== body.version) {
        return problemReply(ErrorCodes.VERSION_CONFLICT);
      }
      state.cues = state.cues.map((cue) => {
        const changed = body.cues.find(({ index }) => index === cue.index);
        return changed ? { ...cue, text: changed.text } : cue;
      });
      return HttpResponse.json(replace({ ...held, kind: 'edited', version: held.version + 1 }));
    }),
    mockEndpoint(uploadCaptionTrack, async ({ request, params }) => {
      const body = await request.json();
      writes.uploads.push({ language: params['lang'], body });
      if (body === BROKEN_VTT) {
        return HttpResponse.json(
          problemDetails({
            code: ErrorCodes.VALIDATION_FAILED,
            status: 422,
            title: ErrorCodes.VALIDATION_FAILED,
            detail: 'The file is not WebVTT',
            instance: 'msw',
            errors: [{ field: 'body', message: 'Line 3: expected a timing line', line: 3 }],
          }),
          { status: 422, headers: { 'content-type': PROBLEM_CONTENT_TYPE } }
        );
      }
      const track = captionTrack({
        language: String(params['lang']),
        kind: 'uploaded',
        version: 1,
        id: '0190c3a0-5e1d-7000-8000-00000000f0ff',
      });
      state.tracks = [...state.tracks.filter(({ language }) => language !== track.language), track];
      return HttpResponse.json(track);
    }),
    mockEndpoint(deleteCaptionTrack, ({ params }) => {
      writes.deletes.push(String(params['lang']));
      state.tracks = state.tracks.filter(({ language }) => language !== params['lang']);
      return new HttpResponse(null, { status: 204 });
    }),
    mockEndpoint(generateCaptions, async ({ request }) => {
      const body = await request.json();
      writes.generates.push(body);
      const held = state.tracks.find(({ language }) => language === (body.language ?? 'en'));
      if (held?.kind === 'edited' && body.overwrite !== true) {
        return problemReply(ErrorCodes.CAPTION_OVERWRITE_UNCONFIRMED);
      }
      return HttpResponse.json(
        replace({ ...(held ?? captionTrack()), kind: 'auto', status: 'pending', url: null }),
        { status: 202 }
      );
    }),
  ];

  return { state, writes, handlers };
}
