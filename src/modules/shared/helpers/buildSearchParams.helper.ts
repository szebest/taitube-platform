import { createSearchParams } from "react-router-dom";

export const buildSearchParams = (newSearchParams: {[k: string]: string}, oldSearchParams: URLSearchParams): URLSearchParams => {
  const searchParams: {[k: string]: string} = {};

  console.log(oldSearchParams.get('search'))
  
  for (const entry of oldSearchParams.entries()) {
    const [param, value] = entry;
    
    searchParams[param] = value;
  }

  for (const entry of Object.entries(newSearchParams)) {
    const [param, value] = entry;
    
    searchParams[param] = value;
  }

  return createSearchParams(searchParams);
}