export type BlogSubcategory = {
  id: string;
  title: string;
  description?: string;
};

export type BlogCategory = {
  id: string;
  title: string;
  description?: string;
  children: BlogSubcategory[];
};

export type BlogPost = {
  slug: string;
  title: string;
  summary: string;
  body: string;
  imageUrl: string | null;
  tags: string[];
  publishedAt: string; // ISO string
  createdAt: string;
  updatedAt: string;
  categoryId?: string | null;
  subcategoryId?: string | null;
  filename?: string;
};
