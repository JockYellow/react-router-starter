import { useState, useEffect } from "react";
import { Link, Outlet, useLoaderData, useLocation } from "react-router";
import type { LoaderFunctionArgs } from "react-router";
import { Github, Mail, MessageSquare, Sparkles } from "lucide-react";
import { DEFAULT_PROFILE, type Profile } from "~/data/profile";
import { PortfolioChat } from "~/features/ai/components/PortfolioChat";
import { toPublicProfile } from "~/features/profile/profile-document";
import { getPublishedProfile } from "~/features/profile/profile.server";
import { requireBlogDb } from "~/lib/d1.server";

export type ResumeOutletContext = { profile: Profile; publishedRevision: number };

const RESUME_INTRO =
  "擅長從客戶使用數據中找到問題、設計流程、推動改善。\n從教育現場、SaaS 客戶成功到 AI 客服與知識庫導入，每一段經歷都在做同一件事——把混亂變成可運作的系統。\n對我來說，解決問題就像騎車爬坡——找到節奏，持續踩踏，終會抵達。";

function withResumeIntro(profile: Profile): Profile {
  return {
    ...profile,
    personal: {
      ...profile.personal,
      intro: RESUME_INTRO,
    },
  };
}

export async function loader({ context }: LoaderFunctionArgs) {
  try {
    const published = await getPublishedProfile(requireBlogDb(context));
    return { ...published, profile: withResumeIntro(published.profile) };
  } catch {
    return {
      profile: withResumeIntro(toPublicProfile(DEFAULT_PROFILE)),
      revision: 0,
      source: "default" as const,
    };
  }
}

function GlobalHeader({ profile }: { profile: Profile }) {
  const [isScrolled, setIsScrolled] = useState(false);
  const { pathname } = useLocation();
  const showBackToResume = pathname !== "/resume";

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 50);
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <header
      className={`fixed top-0 left-0 w-full z-50 transition-all duration-300 ${
        isScrolled
          ? "bg-white/80 backdrop-blur-md border-b border-white/20 shadow-sm"
          : "bg-transparent"
      }`}
    >
      <div className="flex justify-between items-center px-6 py-3 max-w-5xl mx-auto">
        <div className="flex items-center gap-4">
          <Link
            to="/resume"
            className="font-bold text-neutral-800 hover:text-brand-500 transition-colors text-sm"
          >
            {profile.personal.name}{" "}
            <span className="hidden text-neutral-400 font-normal sm:inline">| Product Ops</span>
          </Link>
          {showBackToResume && (
            <Link
              to="/resume"
              className="text-xs text-neutral-400 hover:text-brand-500 transition-colors"
            >
              <span className="sm:hidden">← 履歷</span>
              <span className="hidden sm:inline">← 回到履歷</span>
            </Link>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Link
            to="/resume/company-fit"
            className="btn-ghost text-xs flex items-center gap-1.5"
            title="AI 公司適配分析"
          >
            <Sparkles size={13} />
            <span className="hidden lg:inline">公司適配</span>
          </Link>
          <Link
            to="/resume/guestbook"
            className="btn-ghost text-xs flex items-center gap-1.5"
          >
            <MessageSquare size={13} />
            <span className="hidden sm:inline">留言版</span>
          </Link>
          <a
            href={`mailto:${profile.personal.email}`}
            className="btn-ghost text-xs flex items-center gap-1.5"
          >
            <Mail size={13} />
            <span className="hidden sm:inline">Email</span>
          </a>
          <a
            href={profile.personal.github}
            target="_blank"
            rel="noreferrer"
            className="btn-ghost text-xs flex items-center gap-1.5"
          >
            <Github size={13} />
            <span className="hidden sm:inline">GitHub</span>
          </a>
        </div>
      </div>
    </header>
  );
}

export default function ResumeLayout() {
  const { profile, revision } = useLoaderData<typeof loader>();
  return (
    <div className="resume-shell min-h-screen pb-20">
      <div className="resume-noise" aria-hidden />
      <div className="resume-aurora" aria-hidden />

      <GlobalHeader profile={profile} />

      <div className="resume-content relative z-10 mx-auto w-full max-w-[1200px] px-2 md:px-4">
        <Outlet context={{ profile, publishedRevision: revision } satisfies ResumeOutletContext} />
      </div>

      <PortfolioChat profile={profile} />
    </div>
  );
}
