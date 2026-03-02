import { useState, useEffect } from "react";
import { Link, Outlet, useLocation } from "react-router";
import { Github, Mail, MessageSquare } from "lucide-react";

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
            黃彥禎{" "}
            <span className="text-neutral-400 font-normal">| Product Ops</span>
          </Link>
          {showBackToResume && (
            <Link
              to="/resume"
              className="text-xs text-neutral-400 hover:text-brand-500 transition-colors"
            >
              ← 回到履歷
            </Link>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Link
            to="/resume/guestbook"
            className="btn-ghost text-xs flex items-center gap-1.5"
          >
            <MessageSquare size={13} />
            <span className="hidden sm:inline">留言版</span>
          </Link>
          <a
            href="mailto:hyjock777@outlook.com"
            className="btn-ghost text-xs flex items-center gap-1.5"
          >
            <Mail size={13} />
            <span className="hidden sm:inline">Email</span>
          </a>
          <a
            href="https://github.com/JockYellow"
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
    </div>
  );
}
