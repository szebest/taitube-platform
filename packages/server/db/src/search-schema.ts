import { type SQL, sql } from 'drizzle-orm';
import { playlists } from './library-schema';
import { channels, videos } from './schema';

/**
 * Must match the configuration `0014_search_vectors.sql` builds every `search_vector` with, or a
 * query tokenizes differently from the documents it searches.
 */
export const SEARCH_TEXT_CONFIG = 'simple';

/**
 * The generated `search_vector` columns stay out of the Drizzle tables on purpose: every
 * `select()` of a video, channel or playlist would otherwise carry the whole vector along. The
 * migration owns the columns and their GIN and trigram indexes; queries reach them here.
 */
export const searchVectors: Record<'videos' | 'channels' | 'playlists', SQL> = {
  videos: sql`${videos}."search_vector"`,
  channels: sql`${channels}."search_vector"`,
  playlists: sql`${playlists}."search_vector"`,
};
