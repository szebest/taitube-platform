import { z } from "zod";

import { IN_VIEW_LOCAL_STORAGE_KEY } from "#app/config";
import { useStoredState } from "#app/hooks/use-stored-state";

const ListView = z.boolean();

export const useIsView = () => {
	const [isListView, setIsListView] = useStoredState(IN_VIEW_LOCAL_STORAGE_KEY, ListView, false);

	return [isListView, setIsListView] as const;
};
