import { EditVideoFormModel } from "src/modules/shared/models";

export type UploadFormModel = {
  file: [File];
} & EditVideoFormModel;