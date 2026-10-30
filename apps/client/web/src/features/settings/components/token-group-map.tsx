import { type TokenGroup, tokenGroups } from '@vp/design-tokens';
import { useAppearance } from '@vp/ui';
import type { ComponentType } from 'react';

import {
  AmbientPreview,
  BorderPreview,
  MotionPreview,
  RadiusPreview,
  ShadowPreview,
  SizingPreview,
  SpacingPreview,
  TextPreview,
} from './token-previews';

/**
 * The preview each token group draws. The registry decides which groups and sets appear and the
 * catalogue words them by the same group name (`settings.rowLabel`, `settings.groupDescription`),
 * so the type asks this one table for the part only the feature can write.
 */
export const TOKEN_GROUP_PREVIEWS: Readonly<Record<TokenGroup, ComponentType>> = {
  typography: TextPreview,
  fontSize: TextPreview,
  spacing: SpacingPreview,
  sizing: SizingPreview,
  radius: RadiusPreview,
  border: BorderPreview,
  shadow: ShadowPreview,
  ambient: AmbientPreview,
  motion: MotionPreview,
};

export interface SetPreviewProps {
  group: TokenGroup;
  setId: string;
}

/** A group's preview under one set: the `data-<group>` and `data-mode` attributes the generated CSS is scoped by, on the element holding it. */
export function SetPreview({ group, setId }: SetPreviewProps) {
  const Preview = TOKEN_GROUP_PREVIEWS[group];
  const { shownMode } = useAppearance();

  return (
    <div data-mode={shownMode} {...{ [`data-${tokenGroups[group].path}`]: setId }}>
      <Preview />
    </div>
  );
}
