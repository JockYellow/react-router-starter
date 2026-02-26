import { Link, Outlet, useLocation } from "react-router";
import { BriefcaseBusiness, Github, Mail, Sparkles } from "lucide-react";

const CONTACTS = [
  {
    label: "Email",
    href: "mailto:hyjock777@outlook.com",
    icon: Mail,
    text: "hyjock777@outlook.com",
  },
  {
    label: "GitHub",
    href: "https://github.com/JockYellow",
    icon: Github,
    text: "JockYellow",
  },
];

export default function ResumeLayout() {
  const { pathname } = useLocation();
  const showBackToResume = pathname !== "/resume";

  return (
    <div className="resume-shell min-h-screen pb-20">
      <div className="resume-noise" aria-hidden />
      <div className="resume-aurora" aria-hidden />

      <header className="resume-masthead resume-masthead-fixed">
        <div className="resume-masthead-grid">
          <div className="space-y-4">
            <p className="resume-kicker">
              <BriefcaseBusiness size={14} />
              Job Search Portfolio
            </p>
            <h1 className="resume-title">黃彥禎 | 求職專用履歷網站</h1>
            <p className="resume-purpose">
              這個區塊專門用於應徵 Customer Success / Product Operations 相關職缺，重點展示工作成果、問題解法與可落地的執行能力。
            </p>
          </div>

          <div className="resume-contact-wrap">
            <p className="resume-contact-title">
              <Sparkles size={14} />
              快速聯繫
            </p>
            <div className="flex flex-wrap gap-2">
              {CONTACTS.map(({ label, href, icon: Icon, text }) => (
                <a
                  key={label}
                  href={href}
                  target={href.startsWith("http") ? "_blank" : undefined}
                  rel={href.startsWith("http") ? "noreferrer" : undefined}
                  className="resume-contact-chip"
                >
                  <Icon size={13} />
                  <span>{text}</span>
                </a>
              ))}
            </div>
            {showBackToResume ? (
              <Link to="/resume" className="resume-home-link">
                回到 /resume
              </Link>
            ) : null}
          </div>
        </div>
      </header>

      <div className="resume-content relative z-10 mx-auto w-full max-w-[1200px] px-2 md:px-4">
        <Outlet />
      </div>
    </div>
  );
}
