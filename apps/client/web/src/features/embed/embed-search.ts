import { z } from 'zod';

const StartTimeSchema = z.coerce.number().int().nonnegative();

/** `1` or `0` as the URL spells it, so the router finds the parsed search equal to the one it was handed. */
function onlyWhen<Value extends 0 | 1>(wanted: Value) {
  return z
    .unknown()
    .optional()
    .transform((value) => (String(value) === String(wanted) ? wanted : undefined));
}

/**
 * The embed parameters, as an iframe URL carries them. A value that does not parse falls back to
 * the default, so a bad URL still plays the video: autoplay and loop are off, controls are on.
 */
export const EmbedSearchSchema = z.object({
  autoplay: onlyWhen(1),
  t: z
    .unknown()
    .optional()
    .transform((value) => {
      const parsed = StartTimeSchema.safeParse(value);
      return parsed.success ? parsed.data : undefined;
    }),
  controls: onlyWhen(0),
  loop: onlyWhen(1),
});
