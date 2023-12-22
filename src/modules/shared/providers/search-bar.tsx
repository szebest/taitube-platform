import { PropsWithChildren, createContext, useCallback, useContext, useMemo, useState } from "react";
import { createSearchParams, useNavigate } from "react-router-dom";

import { useQuery } from "../hooks";

import { SearchBarModel } from "../models";

type SearchBarContextValue = {
  searchText: string;
  search: (data: SearchBarModel) => void;
  fullscreenSearch: boolean;
  setFullscreenSearch: (fullscreenSearch: boolean) => void;
}

const SearchBarContext = createContext<SearchBarContextValue | undefined>(undefined)

export type SearchBarProviderProps = PropsWithChildren;

export const SearchBarProvider = ({ children }: SearchBarProviderProps) => {
  const query = useQuery();
  const navigate = useNavigate();
  
  const [searchText, setSearchText] = useState(query.get("search") ?? "");
  const [fullscreenSearch, setFullscreenSearch] = useState(false);

  const search = useCallback((data: SearchBarModel) => {
    if (query.get("search") === data.searchText) return;
    
    setSearchText(data.searchText);

    if (data.searchText.length === 0) {
      navigate("");
    } 
    else {
      navigate({
        pathname: "",
        search: createSearchParams({
          search: data.searchText
        }).toString()
      });
    }
  }, []);

  const ctx = useMemo(() => ({
    searchText,
    search,
    fullscreenSearch,
    setFullscreenSearch
  }), [searchText, search, fullscreenSearch, setFullscreenSearch]);

  return (
    <SearchBarContext.Provider value={ctx}>
      {children}
    </SearchBarContext.Provider>
  )
}

export const useSearchBar = () => {
  const ctx = useContext(SearchBarContext)
  if (!ctx) {
    throw new Error('useSearchBar must be used within SearchBarProvider')
  }
  return ctx
}