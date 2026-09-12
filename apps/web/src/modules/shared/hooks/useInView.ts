import { useLocalStorage } from "@uidotdev/usehooks";

import { IN_VIEW_LOCAL_STORAGE_KEY } from "src/config";

export const useIsView = () => {
	const [isListView, setIsListView] = useLocalStorage(IN_VIEW_LOCAL_STORAGE_KEY, false);

	return [isListView, setIsListView] as const;
};