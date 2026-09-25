import { createFileRoute } from '@tanstack/react-router';
import { z } from 'zod';

import { UploadPage } from '#app/modules/Upload';

export const Route = createFileRoute('/_authed/upload/')({
  staticData: { layoutMaxWidth: '1280px' },
  validateSearch: z.object({}),
  component: UploadPage,
});
