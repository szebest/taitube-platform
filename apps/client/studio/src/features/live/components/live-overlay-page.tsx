import { useSuspenseQuery } from '@tanstack/react-query';
import { getRouteApi } from '@tanstack/react-router';
import { useApi } from '@vp/queries';
import { assertNever } from '@vp/result';
import { useAppearance } from '@vp/ui';
import { liveOverlayQueryOptions } from '../api/live-queries';
import { OverlayAlerts } from './overlay-alerts';
import { OverlayChat } from './overlay-chat';
import { OverlayGoal } from './overlay-goal';

const route = getRouteApi('/live/overlay/$token');

const PLACEMENT = {
  chat: 'justify-end',
  alerts: 'items-center',
  goal: 'justify-end',
} as const;

/** One widget on a transparent ground, in dark colours whatever the viewer's mode, for a 1920 by 1080 OBS browser source. */
export function LiveOverlayPage() {
  const { token } = route.useParams();
  const { widget } = route.useSearch();
  const { data } = useSuspenseQuery(liveOverlayQueryOptions(useApi(), token));
  const { resolved } = useAppearance();

  const widgetOf = () => {
    switch (widget) {
      case 'chat':
        return <OverlayChat liveStreamId={data.stream.id} />;
      case 'alerts':
        return <OverlayAlerts subscriberCount={data.subscriberCount} />;
      case 'goal':
        return <OverlayGoal subscriberCount={data.subscriberCount} />;
      default:
        return assertNever(widget, 'overlay widget');
    }
  };

  return (
    <main
      data-obs-overlay
      data-theme={resolved.theme.id}
      data-mode="dark"
      className={`flex min-h-dvh flex-col p-inset-card text-fg ${PLACEMENT[widget]}`}
    >
      {widgetOf()}
    </main>
  );
}
