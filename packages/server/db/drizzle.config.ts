import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: [
    './src/schema.ts',
    './src/social-schema.ts',
    './src/comments-schema.ts',
    './src/comment-reports-schema.ts',
    './src/view-schema.ts',
    './src/library-schema.ts',
    './src/user-events-schema.ts',
    './src/preferences-schema.ts',
    './src/captions-schema.ts',
    './src/notifications-schema.ts',
    './src/search-history-schema.ts',
    './src/clips-schema.ts',
    './src/channel-featured-schema.ts',
    './src/picks-schema.ts',
    './src/webhooks-schema.ts',
  ],
  out: './drizzle',
  dialect: 'postgresql',
  strict: true,
  verbose: true,
});
