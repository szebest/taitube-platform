import { StageGlow, StagePlayer, StagePoster, StageRoot, StageStatus } from './stage';

export const Stage = {
  Root: StageRoot,
  Glow: StageGlow,
  Player: StagePlayer,
  Poster: StagePoster,
  Status: StageStatus,
};

export { StageSkeleton } from './stage';

export { useStage } from './stage.context';
export { stageStyles } from './stage.variants';
