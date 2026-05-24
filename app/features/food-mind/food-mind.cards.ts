import type {
  FoodMindCard,
  FoodMindRankingSet,
  FoodMindScoreOption,
  FoodMindThemeConfig,
  FoodMindThemeId,
} from "./food-mind.types";

export const FOOD_MIND_THEMES: FoodMindThemeConfig[] = [
  {
    id: "breakfast_shop",
    mode: "rating",
    name: "早餐店讀心局",
    description: "用粗粒度早餐類型校準彼此喜好，不拆到單一加料。",
    estimatedMinutes: "8-10 分鐘",
  },
  {
    id: "hotpot",
    mode: "rating",
    name: "火鍋局",
    description: "用火鍋常見類型抓出共同可吃、地雷和湯底分歧。",
    estimatedMinutes: "8-10 分鐘",
  },
  {
    id: "bubble_tea",
    mode: "ranking",
    name: "手搖飲排序局",
    description: "手搖太看店家，先排序飲料類型和配料偏好。",
    estimatedMinutes: "5-7 分鐘",
  },
];

export const FOOD_MIND_FIXED_PLAYERS = [
  { key: "rouan", name: "柔安", slot: 1 },
  { key: "yanzhen", name: "彥禎", slot: 2 },
] as const;

export type FoodMindFixedPlayerKey = (typeof FOOD_MIND_FIXED_PLAYERS)[number]["key"];

export function getFoodMindFixedPlayer(key: string) {
  return FOOD_MIND_FIXED_PLAYERS.find((player) => player.key === key) ?? null;
}

export function getFoodMindTheme(themeId: string | null | undefined): FoodMindThemeConfig {
  return FOOD_MIND_THEMES.find((theme) => theme.id === themeId) ?? FOOD_MIND_THEMES[0];
}

export const FOOD_MIND_SCORE_OPTIONS: FoodMindScoreOption[] = [
  { score: 5, label: "超愛", hint: "會主動點" },
  { score: 4, label: "喜歡", hint: "看到會開心" },
  { score: 3, label: "可以", hint: "不排斥" },
  { score: 2, label: "看情況", hint: "要看店或心情" },
  { score: 1, label: "不太想", hint: "通常會避開" },
  { score: 0, label: "不行", hint: "明確地雷" },
];

export const BREAKFAST_SHOP_CARDS: FoodMindCard[] = [
  {
    id: "danbing",
    theme: "breakfast_shop",
    name: "蛋餅",
    tags: ["早餐店", "主食", "煎物"],
    group: "主食",
    description: "蛋餅作為一整類，不限定口味或加料。",
  },
  {
    id: "toast",
    theme: "breakfast_shop",
    name: "吐司",
    tags: ["早餐店", "主食", "夾餡"],
    group: "主食",
    description: "火腿蛋、鮪魚蛋、肉鬆蛋等吐司都算在這題。",
  },
  {
    id: "burger",
    theme: "breakfast_shop",
    name: "漢堡",
    tags: ["早餐店", "主食", "夾餡"],
    group: "主食",
    description: "早餐店漢堡整類，不細分豬肉、雞腿或起司。",
  },
  {
    id: "teppan_noodles",
    theme: "breakfast_shop",
    name: "鐵板麵",
    tags: ["早餐店", "主食", "重口味"],
    group: "主食",
    description: "不細分黑胡椒或蘑菇，先看整體接受度。",
  },
  {
    id: "thick_toast",
    theme: "breakfast_shop",
    name: "厚片",
    tags: ["早餐店", "甜口", "吐司"],
    group: "甜口",
    description: "花生、奶酥、巧克力等甜厚片都算在這題。",
  },
  {
    id: "turnip_cake",
    theme: "breakfast_shop",
    name: "蘿蔔糕",
    tags: ["早餐店", "中式", "煎物"],
    group: "中式",
    description: "煎蘿蔔糕，可想像含醬油膏版本。",
  },
  {
    id: "rice_roll",
    theme: "breakfast_shop",
    name: "飯糰",
    tags: ["早餐店", "中式", "米食"],
    group: "中式",
    description: "台式早餐飯糰，不細分配料。",
  },
  {
    id: "shaobing_youtiao",
    theme: "breakfast_shop",
    name: "燒餅油條",
    tags: ["早餐店", "中式", "酥脆"],
    group: "中式",
    description: "燒餅和油條組合，偏中式早餐情境。",
  },
  {
    id: "scallion_pancake",
    theme: "breakfast_shop",
    name: "蔥抓餅",
    tags: ["早餐店", "煎物", "酥脆"],
    group: "煎物",
    description: "含加蛋版本，但不再細分口味。",
  },
  {
    id: "fried_sides",
    theme: "breakfast_shop",
    name: "炸物小點",
    tags: ["早餐店", "炸物", "配餐"],
    group: "配餐",
    description: "薯餅、雞塊、熱狗、薯條等小點合併回答。",
  },
  {
    id: "breakfast_milk_tea",
    theme: "breakfast_shop",
    name: "早餐店奶茶",
    tags: ["早餐店", "飲料", "奶茶"],
    group: "飲料",
    description: "早餐店奶茶或大冰奶，不細分冰熱。",
  },
  {
    id: "soy_milk",
    theme: "breakfast_shop",
    name: "豆漿",
    tags: ["早餐店", "飲料", "豆製品"],
    group: "飲料",
    description: "早餐店或中式早餐常見豆漿。",
  },
];

export const HOTPOT_CARDS: FoodMindCard[] = [
  {
    id: "meat_slices",
    theme: "hotpot",
    name: "肉片",
    tags: ["火鍋", "肉類", "主菜"],
    group: "主菜",
    description: "牛、豬、羊肉片合併看整體偏好。",
  },
  {
    id: "seafood",
    theme: "hotpot",
    name: "海鮮",
    tags: ["火鍋", "海鮮", "主菜"],
    group: "主菜",
    description: "蝦、蛤蜊、魚片、透抽等海鮮合併回答。",
  },
  {
    id: "leafy_vegetables",
    theme: "hotpot",
    name: "青菜",
    tags: ["火鍋", "蔬菜", "清爽"],
    group: "蔬菜",
    description: "高麗菜、娃娃菜、青江菜等葉菜類。",
  },
  {
    id: "mushrooms",
    theme: "hotpot",
    name: "菇類",
    tags: ["火鍋", "蔬菜", "口感"],
    group: "蔬菜",
    description: "金針菇、杏鮑菇、香菇等菇類。",
  },
  {
    id: "tofu_skin",
    theme: "hotpot",
    name: "豆腐豆皮",
    tags: ["火鍋", "豆製品", "吸湯"],
    group: "豆製品",
    description: "豆腐、凍豆腐、豆皮、腐竹合併回答。",
  },
  {
    id: "dumplings",
    theme: "hotpot",
    name: "餃類",
    tags: ["火鍋", "加工料", "餃類"],
    group: "火鍋料",
    description: "蛋餃、魚餃、燕餃、蝦餃等火鍋餃類。",
  },
  {
    id: "balls",
    theme: "hotpot",
    name: "丸類",
    tags: ["火鍋", "加工料", "丸類"],
    group: "火鍋料",
    description: "貢丸、魚丸、花枝丸、起司丸等丸類。",
  },
  {
    id: "staple_food",
    theme: "hotpot",
    name: "主食",
    tags: ["火鍋", "澱粉", "收尾"],
    group: "主食",
    description: "白飯、王子麵、冬粉、烏龍麵等主食。",
  },
  {
    id: "dipping_sauce",
    theme: "hotpot",
    name: "沾醬",
    tags: ["火鍋", "調味", "沙茶"],
    group: "調味",
    description: "沙茶、蒜泥、蔥花、醬油等沾醬習慣。",
  },
  {
    id: "spicy_base",
    theme: "hotpot",
    name: "辣湯底",
    tags: ["火鍋", "湯底", "辣"],
    group: "湯底",
    description: "泛指有辣度的湯底，不限定麻辣鍋。",
  },
  {
    id: "milk_hotpot",
    theme: "hotpot",
    name: "牛奶鍋",
    tags: ["火鍋", "湯底", "濃郁"],
    group: "湯底",
    description: "奶香濃郁的火鍋湯底。",
  },
  {
    id: "mala_hotpot",
    theme: "hotpot",
    name: "麻辣鍋",
    tags: ["火鍋", "湯底", "重口味"],
    group: "湯底",
    description: "偏重口味、麻香與辣感明顯的湯底。",
  },
];

export const BUBBLE_TEA_RANKING_SETS: FoodMindRankingSet[] = [
  {
    id: "drink_type",
    theme: "bubble_tea",
    title: "飲料類型偏好",
    options: ["純茶", "奶茶", "鮮奶茶", "水果茶", "冬瓜系", "多多系", "奶蓋系", "黑糖鮮奶"],
    description: "先不看品牌和細項，排出看到菜單時最有吸引力的飲料類型。",
  },
  {
    id: "topping",
    theme: "bubble_tea",
    title: "配料偏好",
    options: ["珍珠", "椰果", "布丁", "仙草", "茶凍", "粉粿", "芋圓", "不要加料"],
    description: "只看配料傾向，不綁定某一家店的口感。",
  },
];

export const FOOD_MIND_CARDS_BY_THEME: Record<Exclude<FoodMindThemeId, "bubble_tea">, FoodMindCard[]> = {
  breakfast_shop: BREAKFAST_SHOP_CARDS,
  hotpot: HOTPOT_CARDS,
};

const CARD_MAP = new Map(
  Object.values(FOOD_MIND_CARDS_BY_THEME)
    .flat()
    .map((card) => [`${card.theme}:${card.id}`, card]),
);

const RANKING_SET_MAP = new Map(BUBBLE_TEA_RANKING_SETS.map((set) => [`${set.theme}:${set.id}`, set]));

export function getFoodMindCardsByTheme(themeId: FoodMindThemeId): FoodMindCard[] {
  return themeId === "bubble_tea" ? [] : FOOD_MIND_CARDS_BY_THEME[themeId];
}

export function getFoodMindRankingSetsByTheme(themeId: FoodMindThemeId): FoodMindRankingSet[] {
  return themeId === "bubble_tea" ? BUBBLE_TEA_RANKING_SETS : [];
}

export function getFoodMindItemIdsByTheme(themeId: FoodMindThemeId): string[] {
  const theme = getFoodMindTheme(themeId);
  return theme.mode === "ranking"
    ? getFoodMindRankingSetsByTheme(themeId).map((set) => set.id)
    : getFoodMindCardsByTheme(themeId).map((card) => card.id);
}

export function getFoodMindCard(themeId: FoodMindThemeId, cardId: string): FoodMindCard | null {
  return CARD_MAP.get(`${themeId}:${cardId}`) ?? null;
}

export function getFoodMindCards(themeId: FoodMindThemeId, cardIds: string[]): FoodMindCard[] {
  return cardIds.map((cardId) => getFoodMindCard(themeId, cardId)).filter((card): card is FoodMindCard => Boolean(card));
}

export function getFoodMindRankingSet(themeId: FoodMindThemeId, setId: string): FoodMindRankingSet | null {
  return RANKING_SET_MAP.get(`${themeId}:${setId}`) ?? null;
}

export function getFoodMindRankingSets(themeId: FoodMindThemeId, setIds: string[]): FoodMindRankingSet[] {
  return setIds.map((setId) => getFoodMindRankingSet(themeId, setId)).filter((set): set is FoodMindRankingSet => Boolean(set));
}
