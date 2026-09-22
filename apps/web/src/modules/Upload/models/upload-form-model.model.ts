import type { StartUpload } from "@vp/api-contracts";

export type UploadFormModel = Pick<StartUpload, 'title' | 'visibility'> & {
  file: [File];
};
