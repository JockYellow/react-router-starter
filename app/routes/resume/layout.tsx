import { useState, useEffect } from "react";
import { Link, Outlet, useLocation } from "react-router";
import { Github, Mail, MessageSquare, Sparkles } from "lucide-react";
import { PROFILE } from "~/data/profile";
import { PortfolioChat } from "~/features/ai/components/PortfolioChat";

function GlobalHeader() {
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
            {PROFILE.personal.name}{" "}
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
            href={`mailto:${PROFILE.personal.email}`}
            className="btn-ghost text-xs flex items-center gap-1.5"
          >
            <Mail size={13} />
            <span className="hidden sm:inline">Email</span>
          </a>
          <a
            href={PROFILE.personal.github}
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
  return (
    <div className="resume-shell min-h-screen pb-20">
      <div className="resume-noise" aria-hidden />
      <div className="resume-aurora" aria-hidden />

      <GlobalHeader />

      <div className="resume-content relative z-10 mx-auto w-full max-w-[1200px] px-2 md:px-4">
        <Outlet />
      </div>

      <PortfolioChat />
    </div>
  );
}
