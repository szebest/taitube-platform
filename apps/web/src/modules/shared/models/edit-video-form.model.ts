import type { UpdateVideoMetadata } from "@vp/api-contracts";

export type EditVideoFormModel = Pick<UpdateVideoMetadata, 'title' | 'description' | 'visibility'>;
