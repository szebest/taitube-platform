import { isErr } from '@vp/result';
import { AnySchema, CaptionListSchema } from '../responses';
import { type Scenario, actorOf, readyVideos, userById } from '../scenario';
import { createTally } from '../tally';

const LANGUAGES = ['en', 'es'] as const;
const LINES: Record<(typeof LANGUAGES)[number], readonly string[]> = {
  en: [
    'This is a generated demo clip.',
    'The picture is a test pattern.',
    'The sound is a plain tone.',
  ],
  es: [
    'Este es un clip de demostracion.',
    'La imagen es un patron de prueba.',
    'El sonido es un tono simple.',
  ],
};

function timestamp(totalSeconds: number): string {
  const whole = Math.floor(totalSeconds);
  const part = (value: number) => String(value).padStart(2, '0');
  return `${part(Math.floor(whole / 3600))}:${part(Math.floor(whole / 60) % 60)}:${part(whole % 60)}.000`;
}

function buildVtt(durationMs: number | null, lines: readonly string[]): string {
  const seconds = Math.max(lines.length, Math.floor((durationMs ?? 9_000) / 1000));
  const slice = seconds / lines.length;
  const cues = lines.map(
    (line, index) =>
      `${index + 1}\n${timestamp(index * slice)} --> ${timestamp((index + 1) * slice - 0.5)}\n${line}`
  );
  return `WEBVTT\n\n${cues.join('\n\n')}\n`;
}

export const captions: Scenario = {
  name: 'captions',
  essential: false,
  needsReady: true,
  requires: ['GET /v1/videos/{id}/captions', 'PUT /v1/videos/{id}/captions/{lang}'],
  async run(context) {
    const { api, world } = context;
    const tally = createTally();
    for (const video of readyVideos(context)) {
      const owner = userById(world, video.spec.ownerId);
      if (!owner) continue;
      const actor = actorOf(owner);
      const listed = await api.send(
        { actor, method: 'GET', path: `/v1/videos/${video.id}/captions` },
        CaptionListSchema
      );
      if (isErr(listed)) {
        tally.fail(listed.error);
        continue;
      }
      const have = new Set(listed.value.tracks.map((track) => track.language));
      const wanted = video.spec.key === 'v01' ? LANGUAGES : LANGUAGES.slice(0, 1);
      for (const language of wanted) {
        if (have.has(language)) {
          tally.existing();
          continue;
        }
        const put = await api.send(
          {
            actor,
            method: 'PUT',
            path: `/v1/videos/${video.id}/captions/${language}`,
            text: { body: buildVtt(video.durationMs, LINES[language]), contentType: 'text/vtt' },
          },
          AnySchema
        );
        if (isErr(put)) tally.fail(put.error);
        else tally.created();
      }
    }
    return tally.outcome('caption tracks');
  },
};
