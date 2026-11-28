import { z } from 'zod';

const AUDIENCES = ['visitor', 'subscriber'] as const;

const PreviewSchema = z
  .unknown()
  .transform((value) => (value === 'draft' ? ('draft' as const) : undefined))
  .optional();

const AudienceSchema = z
  .unknown()
  .transform((value) => AUDIENCES.find((audience) => audience === value))
  .optional();

/** The channel page routes: `preview=draft` asks for the draft, `as` for the audience it is drawn for; anything else is as if absent. */
export const ChannelPageSearchSchema = z.object({ preview: PreviewSchema, as: AudienceSchema });

export type ChannelPageSearch = z.infer<typeof ChannelPageSearchSchema>;
