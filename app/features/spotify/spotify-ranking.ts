// ==========================================
// Spotify Weighted Battle Royale (Pyramid Edition)
// ==========================================
// 核心機制：
// 1. 3 輪積分賽 (Round 1-3)
// 2. 獨贏加權：選1個得3分，選2個得1分 -> 拉開分數差距
// 3. 正金字塔切割：嚴格控制 S 稀少、F 最多
// ==========================================

export type RankingPhase = 
  | "ROUND_1" 
  | "ROUND_2" 
  | "ROUND_3" 
  | "FINISHED";

export type ArtistNode = {
  id: string;
  score: number;       // 積分 (0 ~ 9)
  tier: string;        // 最終層級
  matchHistory: number[]; // 紀錄每一輪拿幾分 (Debug用)
};

export type GroupMatch = {
  ids: string[]; // 4人一組
};

export type RoyaleState = {
  mode: "battle-royale";
  status: RankingPhase;
  
  artists: Record<string, ArtistNode>;
  
  // 階段控制
  currentGroups: GroupMatch[]; 
  currentIndex: number;
  
  // 最終結果
  tiers: Record<string, string[]>; 
};

// [修正] 正金字塔分佈設定 (嚴格遞增，底層最寬)
// 總和為 1.0 (100%)
export const PYRAMID_CONFIG = [
  { label: "S", percent: 0.02 }, // Top 2%  (極稀有，神級)
  { label: "A", percent: 0.05 }, // Next 5% (菁英)
  { label: "B", percent: 0.10 }, // Next 10% (強者)
  { label: "C", percent: 0.15 }, // Next 15% (優秀)
  { label: "D", percent: 0.20 }, // Next 20% (良作)
  { label: "E", percent: 0.23 }, // Next 23% (普通)
  { label: "F", percent: 0.25 }, // Bottom 25% (基座/路人)
];

export function getPyramidTargets(totalCount: number) {
  let remaining = totalCount;
  return PYRAMID_CONFIG.map((config, index) => {
    let count = Math.ceil(totalCount * config.percent);
    if (count > remaining) {
      count = remaining;
    }
    remaining -= count;
    if (index === PYRAMID_CONFIG.length - 1 && remaining > 0) {
      count += remaining;
      remaining = 0;
    }
    return { ...config, count };
  });
}

// --- 核心邏輯 ---

export function initRoyaleState(artistIds: string[]): RoyaleState {
  const artists: Record<string, ArtistNode> = {};
  
  // 為了避免同分時排序完全依照字母順序，給一個極小的隨機小數
  artistIds.forEach(id => {
    artists[id] = { 
      id, 
      score: Math.random() * 0.01, // 微小擾動，方便同分排序
      tier: "?", 
      matchHistory: [] 
    };
  });

  const state: RoyaleState = {
    mode: "battle-royale",
    status: "ROUND_1",
    artists,
    currentGroups: [],
    currentIndex: 0,
    tiers: { S:[], A:[], B:[], C:[], D:[], E:[], F:[] }
  };

  return generateGroups(state, artistIds);
}

function generateGroups(state: RoyaleState, ids: string[]): RoyaleState {
  const shuffled = shuffleArray([...ids]);
  const groups: GroupMatch[] = [];

  while (shuffled.length > 0) {
    groups.push({ ids: shuffled.splice(0, 4) });
  }

  return {
    ...state,
    currentGroups: groups,
    currentIndex: 0
  };
}

/**
 * [UI 互動] 提交選擇結果
 * 邏輯：依據選擇數量給予不同分數
 * * [UI 提示 - 給 AI 的修改指引]
 * 1. 在前端介面限制 winnerIds 長度：最少 1 個，最多 2 個。
 * 2. 顯示動態按鈕文字：
 * - 選 1 個時顯示：「確認單選 (+3分) 🏆」
 * - 選 2 個時顯示：「確認雙選 (+1分) ⚖️」
 */
export function applyGroupSelection(state: RoyaleState, winnerIds: string[]): RoyaleState {
  if (state.status === "FINISHED") return state;
  
  const currentGroup = state.currentGroups[state.currentIndex];
  const newArtists = { ...state.artists };

  // --- 計分邏輯 ---
  // 獨贏 (Solo): +3分
  // 雙選 (Dual): +1分
  const points = winnerIds.length === 1 ? 3 : 1;

  currentGroup.ids.forEach(id => {
    if (winnerIds.includes(id)) {
      newArtists[id].score += points;
      newArtists[id].matchHistory.push(points);
    } else {
      newArtists[id].matchHistory.push(0);
    }
  });

  // --- 進度推進 ---
  const nextIndex = state.currentIndex + 1;

  if (nextIndex >= state.currentGroups.length) {
    // 本輪結束
    const allIds = Object.keys(newArtists);

    if (state.status === "ROUND_1") {
      // 進入 R2
      return generateGroups({
        ...state,
        status: "ROUND_2",
        artists: newArtists,
      }, allIds);

    } else if (state.status === "ROUND_2") {
      // 進入 R3
      return generateGroups({
        ...state,
        status: "ROUND_3",
        artists: newArtists,
      }, allIds);

    } else {
      // R3 結束 -> 結算金字塔
      const finalTiers = calculatePyramidTiers(newArtists);
      return {
        ...state,
        status: "FINISHED",
        artists: newArtists,
        currentGroups: [],
        tiers: finalTiers
      };
    }
  }

  return {
    ...state,
    artists: newArtists,
    currentIndex: nextIndex
  };
}

/**
 * 最終結算：強制金字塔分配
 */
function calculatePyramidTiers(artists: Record<string, ArtistNode>): Record<string, string[]> {
    // 1. 排序：高分 -> 低分
    const sortedIds = Object.values(artists)
        .sort((a, b) => b.score - a.score)
        .map(node => node.id);
    
    const totalCount = sortedIds.length;
    const tiers: Record<string, string[]> = { S:[], A:[], B:[], C:[], D:[], E:[], F:[] };
    
    let currentIndex = 0;

    // 2. 依照設定比例切蛋糕
    PYRAMID_CONFIG.forEach(config => {
        // 計算這一層該有幾人
        let count = Math.ceil(totalCount * config.percent);
        
        // 邊界檢查
        if (currentIndex + count > totalCount) {
            count = totalCount - currentIndex;
        }

        // 截取 ID
        const tierIds = sortedIds.slice(currentIndex, currentIndex + count);
        tiers[config.label] = tierIds;
        
        currentIndex += count;
    });

    // 3. 處理浮點數誤差剩下的 (全塞進 F 層 - 基座)
    if (currentIndex < totalCount) {
        const lastTier = PYRAMID_CONFIG[PYRAMID_CONFIG.length - 1].label;
        const leftovers = sortedIds.slice(currentIndex);
        tiers[lastTier].push(...leftovers);
    }

    return tiers;
}

// --- 輔助函式 ---

export function getRoyaleProgress(state: RoyaleState) {
    if (state.status === "FINISHED") return { percent: 100, label: "完成" };
    
    const current = state.currentIndex + 1;
    const total = state.currentGroups.length;
    const percent = Math.round((current / total) * 100);
    
    let label = "";
    if (state.status === "ROUND_1") label = "第一輪：海選 (加分賽)";
    else if (state.status === "ROUND_2") label = "第二輪：晉級 (加分賽)";
    else label = "第三輪：決戰 (加分賽)";

    return { percent, current, total, label };
}

export function isRoyaleState(value: unknown): value is RoyaleState {
  if (!value || typeof value !== "object") return false;
  const maybe = value as RoyaleState;
  return maybe.mode === "battle-royale";
}

function shuffleArray<T>(array: T[]): T[] {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}
