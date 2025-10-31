// app/root.tsx
import { Link, Outlet } from "react-router";

export function Layout() {
  return (
    <div style={{ maxWidth: 720, margin: "0 auto", padding: 24 }}>
      <header style={{ display: "flex", gap: 16 }}>
        <Link to="/">首頁</Link>
        <Link to="/about">關於我</Link>
      </header>
      <main style={{ marginTop: 24 }}>
        <Outlet />
      </main>
      <footer style={{ marginTop: 48, fontSize: 12, opacity: 0.7 }}>
        © {new Date().getFullYear()} 你的網站
      </footer>
    </div>
  );
}

// 讓建置器知道這是根布局
export default function Root() {
  return <Layout />;
}
