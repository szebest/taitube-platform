import { Category } from "../models";

const categoryMap = new Map<number, string>([
  [0, "Gaming"],
  [1, "Music"],
  [2, "Sports"],
  [3, "News"],
  [4, "Anime"],
  [5, "IRL"],
  [6, "Tutorial"]
]);

export const mapCategory = (category: number): string => {
  return categoryMap.get(category) ?? "";
}

export const getCategories = (): Category[] => {
  return [...categoryMap.entries()].map(([id, value]) => ({
    id,
    value
  }));
}