import { useLoaderData } from "react-router";
import type { LoaderFunctionArgs } from "react-router";
import { ChevronRight, Lightbulb, Heart, Briefcase, MessageSquare } from "lucide-react";

import { requireBlogDb } from "../../lib/d1.server";
import { getCompanyPage } from "../../features/resume/resume.server";
import type { CompanyPage } from "../../features/resume/resume.types";

type LoaderData = {
  page: CompanyPage;
  experience: string[];
};

export async function loader({ params, context }: LoaderFunctionArgs) {
  const slug = params.companySlug;
  if (!slug) throw new Response("Not Found", { status: 404 });

  const db = requireBlogDb(context);
  const page = await getCompanyPage(db, slug);
  if (!page) throw new Response("Not Found", { status: 404 });

  let experience: string[] = [];
  try {
    experience = JSON.parse(page.relevant_experience ?? "[]");
  } catch {
    experience = [];
  }

  return { page, experience };
}

const SECTION_CONFIG = [
  {
    key: "why_this_company" as const,
    icon: Heart,
    label: "為什麼是這間公司",
    moduleClass: "module-about",
    description: "您對這間公司的理解與認同點",
  },
  {
    key: "what_i_bring" as const,
    icon: Briefcase,
    label: "我能貢獻什麼",
    moduleClass: "module-projects",
    description: "您能帶來的價值與貢獻方式",
  },
  {
    key: "questions_or_ideas" as const,
    icon: MessageSquare,
    label: "想聊的事",
    moduleClass: "module-contact",
    description: "對公司產品 / 技術的觀察，或想討論的事",
  },
];

export default function CompanyResumePage() {
  const { page, experience } = useLoaderData<LoaderData>();

  return (
    <div className="min-h-screen py-12 px-4">
      <div className="max-w-3xl mx-auto">
        {/* 標題 */}
        <div className="module-panel module-hero mb-8">
          <p className="eyebrow mb-2">客製化履歷</p>
          <h1 className="text-3xl md:text-4xl font-black tracking-tight mb-2">
            致 {page.company_name}
          </h1>
          <p className="text-sm text-neutral-500">
            這份頁面是專為 {page.company_name} 準備的補充說明，配合主履歷一起閱讀效果最佳。
          </p>
        </div>

        <div className="space-y-6">
          {/* 相關經歷（獨立渲染，因為是 list） */}
          {experience.length > 0 && (
            <div className="module-panel module-skills">
              <div className="flex items-center gap-2 mb-4">
                <Lightbulb size={18} className="text-accent-500" />
                <h2 className="section-title text-xl">對應的經歷</h2>
              </div>
              <p className="text-xs text-neutral-400 mb-4">
                以下每條經歷都對應到 {page.company_name} 的需求
              </p>
              <ul className="space-y-3">
                {experience.map((item, i) => (
                  <li
                    key={i}
                    className="flex gap-3 items-start text-sm text-neutral-700 leading-relaxed"
                  >
                    <ChevronRight
                      className="shrink-0 mt-0.5 text-brand-400"
                      size={15}
                    />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* 其他三個文字區塊 */}
          {SECTION_CONFIG.map(({ key, icon: Icon, label, moduleClass, description }) => {
            const content = page[key];
            if (!content) return null;
            return (
              <div key={key} className={`module-panel ${moduleClass}`}>
                <div className="flex items-center gap-2 mb-3">
                  <Icon size={18} className="text-accent-500" />
                  <h2 className="section-title text-xl">{label}</h2>
                </div>
                <p className="text-xs text-neutral-400 mb-4">{description}</p>
                <p className="text-sm text-neutral-700 leading-relaxed whitespace-pre-line">
                  {content}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
