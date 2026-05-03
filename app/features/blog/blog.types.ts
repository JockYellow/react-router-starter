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
  content: BlogContentBlock[];
  imageUrl: string | null;
  coverMediaId?: string | null;
  tags: string[];
  publishedAt: string; // ISO string
  createdAt: string;
  updatedAt: string;
  categoryId?: string | null;
  subcategoryId?: string | null;
  filename?: string;
};

export type BlogMediaKind = "image" | "video";

export type BlogMediaAsset = {
  id: string;
  kind: BlogMediaKind;
  r2Key: string;
  publicUrl: string;
  mimeType: string;
  sizeBytes: number;
  width?: number | null;
  height?: number | null;
  durationSec?: number | null;
  alt?: string | null;
  caption?: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null;
};

export type BlogImageLayout = "normal" | "wide" | "full" | "float-left" | "float-right";

export type BlogContentBlock =
  | {
      id: string;
      type: "paragraph";
      props: { text: string };
    }
  | {
      id: string;
      type: "heading";
      props: { text: string; level: 2 | 3 };
    }
  | {
      id: string;
      type: "image";
      props: {
        mediaId?: string;
        src: string;
        alt?: string;
        caption?: string;
        layout?: BlogImageLayout;
      };
    }
  | {
      id: string;
      type: "video";
      props: {
        mediaId?: string;
        src: string;
        mimeType?: string;
        caption?: string;
      };
    }
  | {
      id: string;
      type: "gallery";
      props: {
        items: Array<{
          mediaId?: string;
          src: string;
          alt?: string;
          caption?: string;
        }>;
        layout?: "carousel" | "grid";
      };
    }
  | {
      id: string;
      type: "quote";
      props: { text: string; cite?: string };
    }
  | {
      id: string;
      type: "divider";
      props: Record<string, never>;
    }
  | {
      id: string;
      type: "columns";
      props: {
        columns: Array<{
          blocks: BlogContentBlock[];
        }>;
      };
    };
