import { createFileRoute } from '@tanstack/react-router';
import { VideoIdParamSchema } from '@vp/api-contracts';
import { z } from 'zod';

import { parseParam } from '#app/integrations/router/parse-param';
import { EditPage } from '#app/modules/Upload';

export const Route = createFileRoute('/_authed/upload/edit/$videoId')({
  staticData: { layoutMaxWidth: '1280px' },
  params: {
    parse: ({ videoId }) => ({ videoId: parseParam(VideoIdParamSchema.shape.id, videoId) }),
    stringify: ({ videoId }) => ({ videoId }),
  },
  validateSearch: z.object({}),
  component: EditPage,
});
