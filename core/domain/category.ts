export interface Category {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  iconUrl: string | null;
  sortOrder: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateCategoryInput {
  id?: string;
  slug: string;
  name: string;
  description?: string | null;
  iconUrl?: string | null;
  sortOrder?: number;
  isActive?: boolean;
}

export interface UpdateCategoryInput {
  slug?: string;
  name?: string;
  description?: string | null;
  iconUrl?: string | null;
  sortOrder?: number;
  isActive?: boolean;
}

export interface ListCategoriesOptions {
  activeOnly?: boolean;
}
