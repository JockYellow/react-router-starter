INSERT INTO company_pages
  (slug, company_name, why_this_company, relevant_experience, what_i_bring, questions_or_ideas, created_at, updated_at)
VALUES (
  'template-company',
  '模板公司 Template Co.',
  '我對貴公司在前端技術的深耕與工程文化深感認同，尤其是 React 生態系的應用方向與團隊協作模式，這與我過去的開發經歷高度吻合。我特別欣賞貴公司在產品設計上以使用者為核心的理念，希望能貢獻我的技術與創意。',
  '["使用 React / TypeScript 開發複雜的 SPA 應用，負責架構設計與 Component Library 建立","導入 CI/CD pipeline，顯著縮短部署週期，提升團隊效率 30%","與 PM、設計師緊密協作，完整負責數個核心功能從需求到上線的全流程","建立前端效能監控機制，識別並修復多個關鍵渲染瓶頸"]',
  '扎實的前端工程能力（React、TypeScript、Tailwind CSS）、跨職能溝通與協作能力、對使用者體驗的高度重視，以及快速學習新技術並應用於實際專案的熱忱。',
  '1. 目前前端團隊主要使用什麼技術棧？有沒有計劃導入新框架或工具？
2. 新人入職後通常如何安排第一個月的上手計畫？會有 buddy 制度嗎？
3. 團隊如何進行 Code Review 與知識分享？有固定的技術分享活動嗎？',
  datetime('now'),
  datetime('now')
);
