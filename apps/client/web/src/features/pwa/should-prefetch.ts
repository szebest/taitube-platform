import { z } from 'zod';

const SLOW_CONNECTIONS: ReadonlySet<string> = new Set(['2g', 'slow-2g']);

const ConnectionSchema = z.object({
  saveData: z.boolean().optional(),
  effectiveType: z.string().optional(),
});

/** False when the viewer asked to save data or is on a 2g link; true wherever the browser cannot say. */
export function shouldPrefetch(): boolean {
  if (typeof navigator === 'undefined') {
    return true;
  }

  const connection = ConnectionSchema.safeParse(Reflect.get(navigator, 'connection'));
  if (!connection.success) {
    return true;
  }

  const { saveData, effectiveType } = connection.data;
  return saveData !== true && !SLOW_CONNECTIONS.has(effectiveType ?? '');
}
