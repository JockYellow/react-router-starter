export type CompanyPage = {
  id: number;
  slug: string;
  company_name: string;
  why_this_company: string | null;
  relevant_experience: string; // JSON string → string[]
  what_i_bring: string | null;
  questions_or_ideas: string | null;
  created_at: string;
  updated_at: string;
};

export type CompanyPageInput = {
  slug: string;
  company_name: string;
  why_this_company: string;
  relevant_experience: string[]; // already parsed array
  what_i_bring: string;
  questions_or_ideas: string;
};
