import { PROFILE } from "../../data/profile";

export type StaticFaq = {
  id: string;
  question: string;
  answer: string;
  keywords: string[];
  link?: { href: string; label: string };
};

function compact(items: string[]): string {
  return items.filter(Boolean).join("；");
}

function findExperience(term: string): (typeof PROFILE.workExperience)[number] | null {
  return PROFILE.workExperience.find((experience) =>
    [
      experience.role,
      experience.company,
      experience.summary,
      ...experience.tags,
    ].some((value) => value.toLocaleLowerCase("zh-Hant").includes(term.toLocaleLowerCase("zh-Hant"))),
  ) ?? null;
}

const aiExperience = findExperience("RAG") ?? findExperience("AI 客服");
const saasExperience = findExperience("SaaS") ?? findExperience("COMMEET");
const teachingExperience = findExperience("講師") ?? findExperience("教學");

export const STATIC_FAQS: StaticFaq[] = [
  {
    id: "work-overview",
    question: "可以快速介紹你的工作經歷嗎？",
    answer: `履歷目前列出 ${PROFILE.workExperience.length} 段已確認經歷：${PROFILE.workExperience.map((experience) => `${experience.period} ${experience.company}｜${experience.role}`).join("；")}。共同主軸是把客戶需求、營運流程與資料整理成可執行的系統。`,
    keywords: ["工作經歷", "經歷總覽", "自我介紹", "快速介紹", "做過什麼工作"],
  },
  {
    id: "ai-rag",
    question: "你有哪些 AI 與 RAG 經驗？",
    answer: aiExperience
      ? `${aiExperience.summary}。可確認的成果包括：${compact(aiExperience.highlights.slice(0, 3))}。`
      : "履歷包含 AI 客服、RAG 知識庫檢測、產品設定測試與客戶導入支援經驗。",
    keywords: ["ai經驗", "ai與rag", "rag經驗", "ai客服", "知識庫經驗"],
  },
  {
    id: "customer-success",
    question: "你的 Customer Success 經驗是什麼？",
    answer: saasExperience
      ? `${saasExperience.summary}。履歷中的已確認成果包括：${compact(saasExperience.highlights.slice(0, 3))}。`
      : "履歷包含 SaaS 客戶導入、續約、健康度指標、成效報告與客戶營運流程建立經驗。",
    keywords: ["customersuccess", "customer success", "客戶成功", "cs經驗", "saas經驗"],
  },
  {
    id: "projects",
    question: "有哪些作品或專案可以看？",
    answer: `履歷列出的作品與專案包括：${PROFILE.projects.map((project) => `${project.name}（${project.description}）`).join("；")}。可從履歷首頁的作品區開啟有連結的項目。`,
    keywords: ["作品", "專案", "portfolio", "案例", "作品集"],
  },
  {
    id: "company-fit",
    question: "如何分析你和我們公司的適配度？",
    answer: "請前往「AI 公司適配分析」，填入公司名稱、職缺名稱，並直接貼上職缺內容。系統不會抓取網址；分析會區分使用者提供的資訊與推論。",
    keywords: ["公司適配", "適配度", "適合我們公司", "職缺分析", "公司分析"],
    link: { href: "/resume/company-fit", label: "前往 AI 公司適配分析" },
  },
  {
    id: "training",
    question: "你有教育訓練與授課經驗嗎？",
    answer: teachingExperience
      ? `${teachingExperience.summary}。其中已確認的成果包括：${compact(teachingExperience.highlights.slice(0, 3))}。`
      : "有，履歷包含課程教學、內部講師培訓、課程營運與教材企劃經驗。",
    keywords: ["教育訓練", "授課經驗", "教學經驗", "講師", "培訓經驗"],
  },
  {
    id: "direction",
    question: "你目前想找什麼方向的工作？",
    answer: `目前履歷列出的求職方向為：${PROFILE.jobDirections.join("、")}。更精確的職務範圍與合作方式，建議面談時再確認。`,
    keywords: ["求職方向", "找什麼工作", "想找", "職涯方向", "職務方向"],
  },
  {
    id: "contact",
    question: "如何聯絡你？",
    answer: `可以寄信到 ${PROFILE.personal.email}，或從 GitHub 查看作品：${PROFILE.personal.github}。`,
    keywords: ["如何聯絡", "聯絡方式", "email", "電子郵件", "github"],
  },
];

function normalizeQuestion(value: string): string {
  return value
    .toLocaleLowerCase("zh-Hant")
    .replace(/[\s，。！？、：:,.!?「」『』（）()]/g, "");
}

/** Returns a canonical-profile answer for common questions, without using AI quota. */
export function matchStaticFaq(question: string): StaticFaq | null {
  const normalized = normalizeQuestion(question);
  if (!normalized) return null;

  return STATIC_FAQS.find((faq) => {
    if (normalizeQuestion(faq.question) === normalized) return true;
    return faq.keywords.some((keyword) => normalized.includes(normalizeQuestion(keyword)));
  }) ?? null;
}
