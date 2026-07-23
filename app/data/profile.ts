export const PROFILE_VERSION = "huang-profile-v1";

export type ProfileStory = {
  situation: string;
  action: string;
  result: string;
};

export type ProfileWorkExperience = {
  id: string;
  role: string;
  company: string;
  location: string;
  period: string;
  displayYear: string;
  distance: string;
  vibe: string;
  summary: string;
  highlights: string[];
  details: string[];
  stories: {
    rhythm?: string;
    cases: ProfileStory[];
  };
  tags: string[];
  blogSlug: string;
  links?: { label: string; url: string; external?: boolean }[];
};

export type Profile = {
  version: typeof PROFILE_VERSION;
  personal: {
    name: string;
    title: string;
    location: string;
    email: string;
    github: string;
    intro: string;
    stats: {
      clients: { value: number; label: string; unit: string };
      issues: { value: number; label: string; unit: string };
    };
  };
  jobDirections: string[];
  workExperience: ProfileWorkExperience[];
  skillGroups: { label: string; skills: string[] }[];
  projects: {
    id: string;
    name: string;
    description: string;
    tags: string[];
    externalUrl: string;
    blogSlug: string;
  }[];
  factRules: string[];
};

/**
 * 履歷、FAQ 與 AI prompt 共用的唯一個人事實來源。
 * 僅收錄本人已確認的內容；未完成的履歷草稿與示範 seed 不得加入。
 */
export const PROFILE: Profile = {
  version: PROFILE_VERSION,
  personal: {
    name: "黃彥禎",
    title: "Customer Success · AI Product Ops · Data-Informed Problem Solver",
    location: "新北市, 台灣",
    email: "hyjock777@outlook.com",
    github: "https://github.com/JockYellow",
    intro:
      "擅長從客戶使用數據中找到問題、設計流程、推動改善。\n從教育現場、SaaS 客戶成功到 AI 客服與 RAG 知識庫導入，每一段經歷都在做同一件事——把混亂變成可運作的系統。\n對我來說，解決問題就像騎車爬坡——找到節奏，持續踩踏，終會抵達。",
    stats: {
      clients: { value: 81, label: "Accounts Tracked", unit: "accounts" },
      issues: { value: 16, label: "KB Audits", unit: "bases" },
    },
  },
  jobDirections: [
    "Customer Success / 客戶成功",
    "AI Product Operations / AI 產品導入營運",
    "資料導向的客戶營運與產品協作",
  ],
  workExperience: [
    {
      id: "exp-0",
      role: "客戶成功經理",
      company: "愛吠的狗娛樂股份有限公司（數位內容產業）",
      location: "新北市三重區",
      period: "2026/04 – 2026/07",
      displayYear: "2026",
      distance: "16 座知識庫 / 5 份使用簡報",
      vibe: "一段 AI 產品導入的短坡測試——在問答系統、電話客服與 RAG 知識庫之間，把客戶需求轉成可驗證的設定與文件。",
      summary: "支援 AI 問答系統、AI 電話客服與 RAG 知識庫產品導入，負責設定、測試、文件整理與產品說明",
      highlights: [
        "協助檢測分析 16 間 AI 知識庫問題，涵蓋百貨公司、動物園、車站等不同使用場景",
        "製作 5 份客戶使用簡報，整理用量、QA 類型與知識庫內容，提出初步使用觀察與優化建議",
        "製作內部專案快速健康度檢測表，可快速檢視 30 間線上客戶使用量與 10 間客戶機台操作點擊",
      ],
      details: [
        "參與公部門 AI 專案需求整理與變更溝通，協助團隊釐清客戶需求與產品限制",
        "支援 AI 問答系統、AI 電話客服與 RAG 知識庫設定、測試與文件整理",
        "支援 COMPUTEX 展會布展與現場產品展示，協助向潛在客戶說明 AI 客服與知識庫應用",
      ],
      stories: {
        rhythm:
          "工作節奏圍繞 AI 產品導入支援、知識庫檢測、客戶使用資料整理與產品說明。日常需要在客戶情境、知識庫內容、系統回覆品質與產品限制之間來回校準，將零散問題整理成團隊可討論的觀察與建議。",
        cases: [
          {
            situation: "不同客戶的知識庫場景差異大，包含百貨公司、動物園、車站等公共服務情境，問題類型與內容缺口不容易用單一標準判斷",
            action: "協助檢測 16 間 AI 知識庫，整理 QA 類型、用量狀況與內容問題，將觀察轉成客戶使用簡報與優化建議",
            result: "產出 5 份客戶使用簡報，讓團隊能以用量與知識庫品質作為後續溝通基礎",
          },
          {
            situation: "線上客戶與機台使用狀況分散，團隊需要快速掌握哪些專案需要優先追蹤",
            action: "製作內部專案快速健康度檢測表，集中檢視線上客戶使用量與機台操作點擊",
            result: "支援 30 間線上客戶使用量與 10 間客戶機台操作點擊的快速檢測，提升專案追蹤效率",
          },
        ],
      },
      tags: ["Customer Success", "AI 客服", "RAG", "知識管理", "用量分析", "提案簡報"],
      blogSlug: "",
      links: [
        { label: "AI 健康度檢測 Dashboard", url: "/resume/ai-health-dashboard" },
      ],
    },
    {
      id: "exp-1",
      role: "客戶成功 / 客戶成功營運",
      company: "COMMEET（SaaS 費用管理平台）",
      location: "台北, 台灣",
      period: "2024/07 – 2026/03",
      displayYear: "2024",
      distance: "754 萬導入 / 坡度 12%",
      vibe: "一段陡坡長征——從產品理解、客戶導入、流程建置到數據分析，全程獨力完成。",
      summary: "獨立負責從客戶導入到續約的完整生命週期，同步建立 CS 營運機制與數據分析體系",
      highlights: [
        "負責 51 位客戶經營，其中 31 間從導入期獨立接手，合約導入總額 754 萬元",
        "個人續約金額 320 萬，已續約 29 件，自導入客戶續約率 100%",
        "設計客戶健康度指標，產出六維度客製化成效報告（趨勢、內控、簽核效率、合規、企業卡、效益摘要）",
      ],
      details: [
        "累計提報 159 件系統問題、33 件優化建議，推動產品迭代",
        "建立導入分級流程、信件模板化、需求文件標準化，降低交接風險與屬人化依賴",
        "重建 Zendesk 幫助中心文章結構與導航，導入 GIF 互動式說明與檢核表機制",
        "規劃並執行客戶成功講座（議題設定、名單邀請、活動頁建置、回饋蒐集）",
      ],
      stories: {
        rhythm:
          "日常以客戶導入與客戶進度追蹤為主，每週固定 2~3 場客戶會議（導入對焦或成效追蹤），每月產出季度客製化成效報告，執行一場客戶成功講座。跨部門協作主要對象為 PM 和工程團隊，透過 TASK 提報機制推動產品改善。",
        cases: [],
      },
      tags: ["Customer Success", "SQL", "Python", "Zendesk", "Chart.js", "Onboarding", "Data Analysis"],
      blogSlug: "",
      links: [
        { label: "客製化成效報告", url: "/resume/custom-impact-report" },
        { label: "CS 工作定位流程圖", url: "/resume/cs-flow" },
      ],
    },
    {
      id: "exp-2",
      role: "課程規劃師",
      company: "財團法人華岡興業基金會",
      location: "台北, 台灣",
      period: "2022/08 – 2023/01",
      displayYear: "2022",
      distance: "28.5 km / 起伏丘陵",
      vibe: "短距離但地形多變——半年內跑完產品從市場調查到上架銷售的完整流程。",
      summary: "獨立操作實體課程線上販售全流程，從需求調查到預算控管一手包辦",
      highlights: [
        "獨立負責實體課程線上販售全流程：需求調查 → 課程設計 → 預算編製 → 行銷推廣 → 招生執行",
        "編列並控管網路廣告投放預算，追蹤業績表現與轉換成效",
      ],
      details: [
        "撰寫網頁宣傳文案與行銷活動企劃，操作社群與公開資訊平台推廣",
      ],
      stories: { cases: [] },
      tags: ["行銷企劃", "文案撰寫", "廣告投放", "預算管理", "課程產品設計"],
      blogSlug: "",
    },
    {
      id: "exp-3",
      role: "專案管理 / 客戶經理",
      company: "社團法人台灣一起夢想公益協會",
      location: "台北, 台灣",
      period: "2022/04 – 2022/06",
      displayYear: "2022",
      distance: "12.0 km / 短程衝刺",
      vibe: "三個月的高強度衝刺——密集開發、快速驗證、即時調整。",
      summary: "三個月內密集開發非營利組織合作夥伴，同步執行募款專案與行銷推廣",
      highlights: [
        "每月探訪 12 間非營利組織，進行超過 100 通電話開發，建立合作夥伴關係",
        "每月執行 3 檔線上募款活動，撰寫專案募款計畫並追蹤資金使用成效",
      ],
      details: ["協同 Facebook 行銷推廣，策劃並執行公益活動"],
      stories: { cases: [] },
      tags: ["專案管理", "募款企劃", "客戶開發", "社群行銷"],
      blogSlug: "",
    },
    {
      id: "exp-4",
      role: "教學部教務人員 / 講師",
      company: "創思文教股份有限公司（倍思科學）",
      location: "台北, 台灣",
      period: "2020/01 – 2022/01",
      displayYear: "2020",
      distance: "120.2 km / 長距離巡航",
      vibe: "兩年的穩定巡航——在這裡建立了系統化思維的肌肉記憶。",
      summary: "負責課程營運全鏈路，從教學執行、師資培訓到 ERP 系統重整與排課管理",
      highlights: [
        "教授超過 400 堂科學課程，作為內部培訓講師進行超過 100 堂課程培訓",
        "重整公司 ERP 系統，月度安排近 500 堂課程並計算講師鐘點費",
        "將排課規則標準化，建立不同學制需求的合作模板，降低排課出錯率",
      ],
      details: [
        "根據市場需求設計課程教具與企劃，確保符合成本效益目標",
        "疫情期間成功將實體課程轉為線上授課模式",
      ],
      stories: { cases: [] },
      tags: ["教學設計", "ERP 管理", "流程標準化", "師資培訓", "課程企劃"],
      links: [
        { label: "教學部工作流程圖", url: "/resume/teaching-flow" },
      ],
      blogSlug: "",
    },
  ],
  skillGroups: [
    {
      label: "數據 & 分析",
      skills: ["SQL（查詢 / 資料檢核）", "Python（資料處理 / Jinja2 模板）", "用量與 QA 類型分析", "Tableau", "Power BI", "Excel 進階"],
    },
    {
      label: "客戶成功 & 營運",
      skills: [
        "AI 客服 / RAG 導入支援",
        "客戶需求訪談與需求文件",
        "系統導入與教育訓練",
        "跨部門溝通 / 專案管理",
        "Zendesk（工單 / 幫助中心）",
        "Onboarding 流程設計",
        "客戶健康度指標",
        "提案與產品說明",
        "Mailjet（郵件行銷）",
      ],
    },
    {
      label: "前端 & 報表呈現",
      skills: [
        "Prompt 設計（角色 / 背景 / 限制 / 輸出格式 / 驗收條件）",
        "HTML / CSS",
        "Chart.js",
        "Tailwind CSS",
        "Git / GitHub",
        "AI-Assisted Development",
        "知識庫文件整理",
      ],
    },
  ],
  projects: [
    {
      id: "proj-0",
      name: "AI 知識庫健康度檢測",
      description:
        "支援 AI 問答、AI 電話客服與 RAG 知識庫導入，協助檢測 16 間知識庫問題，並製作內部快速健康度檢測表，追蹤 30 間線上客戶使用量與 10 間客戶機台操作點擊。",
      tags: ["AI 客服", "RAG", "知識管理", "用量分析", "Customer Success"],
      externalUrl: "/resume/ai-health-dashboard",
      blogSlug: "",
    },
    {
      id: "proj-1",
      name: "客製化客戶成效報告系統",
      description:
        "為 SaaS 客戶建置六維度分析報告（2200+ 行 HTML），涵蓋費用趨勢、內控健康度、簽核效率、憑證合規、企業卡分析與效益摘要。從 SQL 取數到 Chart.js 視覺化的完整產出流程。",
      tags: ["SQL", "Python", "Chart.js", "Tailwind CSS", "Jinja2"],
      externalUrl: "/resume/custom-impact-report",
      blogSlug: "",
    },
    {
      id: "proj-2",
      name: "Zendesk 幫助中心重建",
      description:
        "重新設計文章結構與導航系統，加入 GIF 操作示範、站台實際頁面示例與保存狀態檢核表，從內容管理推進到知識管理。",
      tags: ["Zendesk", "Knowledge Management", "UX Writing"],
      externalUrl: "",
      blogSlug: "",
    },
    {
      id: "proj-3",
      name: "個人網站",
      description:
        "從一份履歷與零散想法出發，透過與 AI 持續對話、拆解、實作與修正，逐步長成現在的個人平台。",
      tags: ["AI 協作", "需求拆解", "內容設計", "持續迭代"],
      externalUrl: "/resume/building-with-ai",
      blogSlug: "",
    },
  ],
  factRules: [
    "只能引用此 Profile 明確記載的個人經歷、技能、數字與成果。",
    "不得捏造或推測未記載的公司、職稱、年資、客戶、專案、工具、數字或成果。",
    "不得把參與、支援或協助誇大為獨立主導、決策或最終成果歸因。",
    "資料不足時必須清楚說明無法確認，並指出需要本人補充的資訊。",
    "公司與職缺資訊若非使用者提供，必須明確標示為推論，不得當作已知事實。",
  ],
};
