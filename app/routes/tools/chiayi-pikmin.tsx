import { useEffect, useMemo, useState } from "react";

type StopArea = "gateway" | "A" | "B" | "C";

type Stop = {
  id: string;
  time: string;
  type: string;
  title: string;
  desc: string;
  reward: string;
  suggestion: string;
  note: string;
  mapQuery: string;
  area: StopArea;
  mission?: boolean;
  locked?: boolean;
  durationMin: number;
  stay: string;
  travelFromPreviousMin?: number;
  attachments: Array<{ label: string; url: string }>;
};

type DessertStop = {
  name: string;
  area: string;
  address: string;
  timing: string;
  rainPlan: string;
  signature: string;
  mapQuery: string;
  mapX: number;
  mapY: number;
  sourceName: string;
  sourceUrl: string;
};

type PotionStop = {
  name: string;
  area: string;
  pick: string;
  mapQuery: string;
};

const STORAGE_KEY = "chiayi-pikmin-demo-completed";
const ORDER_STORAGE_KEY = "chiayi-pikmin-demo-order-v2";
const officialEventUrl = "https://pikminbloom.com/zh/news/may26-chiayiartsfestivalminiwalk";
const pikminImages = [
  "/chiayi-pikmin/red-pikmin.webp",
  "/chiayi-pikmin/yellow-pikmin.webp",
  "/chiayi-pikmin/blue-pikmin.webp",
  "/chiayi-pikmin/purple-pikmin.webp",
];

const trainInfo = {
  outbound: "609｜台北 07:46 → 嘉義 09:13",
  inbound: "678｜嘉義 19:32 → 台北 20:59",
};

const areaLabels: Record<StopArea, string> = {
  gateway: "高鐵/BRT",
  A: "A 車站西側",
  B: "B 北門藝文",
  C: "C 東門/文化路",
};

function mapSearchUrl(query: string) {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}

function multiPointMapUrl(points: Array<{ mapQuery: string }>) {
  const [origin, ...rest] = points;
  const destination = rest[rest.length - 1] ?? origin;
  const waypoints = rest.slice(0, -1).map((point) => point.mapQuery).join("|");
  return `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(origin.mapQuery)}&destination=${encodeURIComponent(destination.mapQuery)}&waypoints=${encodeURIComponent(waypoints)}&travelmode=walking`;
}

const stops: Stop[] = [
  {
    id: "hsr",
    time: "09:13",
    type: "高鐵 / BRT",
    title: "高鐵 609 抵達嘉義 / BRT 進市區",
    desc: "",
    reward: "抵嘉整備",
    suggestion: "到站後接 BRT 進嘉義市區，第一目標改成阿宏師火雞肉飯；抵達市區先排隊，不先散步。",
    note: "票面時間是 609，台北 07:46 → 嘉義 09:13。",
    mapQuery: "嘉義高鐵站",
    area: "gateway",
    locked: true,
    durationMin: 0,
    stay: "09:13",
    travelFromPreviousMin: 0,
    attachments: [
      { label: "前往市區", url: mapSearchUrl("嘉義高鐵站 到 嘉義文化創意產業園區") },
    ],
  },
  {
    id: "lunch",
    time: "10:13",
    type: "排隊 / 午餐",
    title: "阿宏師火雞肉飯光華總店",
    desc: "",
    reward: "火雞肉飯補給",
    suggestion: "BRT 進城後先往光華路排隊；目標是在開店前後卡位，吃完再開始踩點，不把午餐放到中午尖峰。",
    note: "地址是嘉義市東區光華路108號；多個美食資訊都把它列為排隊名店，當天若隊伍太長就外帶或縮短美術館停留。",
    mapQuery: "阿宏師火雞肉飯 光華總店 嘉義市東區光華路108號",
    area: "C",
    locked: true,
    durationMin: 50,
    stay: "10:13-11:03",
    travelFromPreviousMin: 60,
    attachments: [
      { label: "Google 地點", url: mapSearchUrl("阿宏師火雞肉飯 光華總店 嘉義市東區光華路108號") },
      { label: "排隊備案外帶", url: mapSearchUrl("阿宏師火雞肉飯 外帶") },
    ],
  },
  {
    id: "art-museum",
    time: "12:33",
    type: "踩點 / 逛展",
    title: "嘉義市立美術館",
    desc: "可領金色花苗與明信片。",
    reward: "美術館 Decor",
    suggestion: "看古蹟棟與本館的新舊對照：1936 年原菸酒公賣局嘉義分局、弧形轉角、水平窗帶、SCRATCH 磁磚，以及後來增建的玻璃盒子與木構語彙。",
    note: "官網參觀資訊標示開館 09:00-17:00；當日展覽、售票與休館仍以美術館公告為準。",
    mapQuery: "嘉義市立美術館",
    area: "A",
    mission: true,
    durationMin: 60,
    stay: "12:33-13:33",
    travelFromPreviousMin: 20,
    attachments: [
      { label: "Google 地點", url: mapSearchUrl("嘉義市立美術館") },
      { label: "美術館官網", url: "https://chiayiartmuseum.chiayi.gov.tw/" },
    ],
  },
  {
    id: "creative-park",
    time: "13:38",
    type: "踩點 / 市集",
    title: "嘉義文化創意產業園區",
    desc: "可領金色花苗與明信片。",
    reward: "彩繪 Decor",
    suggestion: "舊酒廠再利用園區，先拿 Pikmin 點位，再看創藝市集、品牌活動、展覽表演與園區建築。",
    note: "官網標示戶外空間 24 小時開放，店家與活動依各自公告；市集有無與時間以園區當日公告/社群為準。",
    mapQuery: "嘉義文化創意產業園區",
    area: "A",
    mission: true,
    durationMin: 60,
    stay: "13:38-14:38",
    travelFromPreviousMin: 5,
    attachments: [
      { label: "Google 地點", url: mapSearchUrl("嘉義文化創意產業園區") },
      { label: "活動資訊", url: officialEventUrl },
    ],
  },
  {
    id: "city-museum",
    time: "14:58",
    type: "踩點 / 逛展",
    title: "嘉義市立博物館",
    desc: "可領金色花苗與明信片。",
    reward: "禮物貼紙（金色）Decor",
    suggestion: "把它當城市博物館看：官網目前列出諸羅城、嘉義工藝、兒童策展、火雞肉飯等在地題材；選 1-2 個主題慢看，比每區都掃過有感。",
    note: "部分特展可能售票或依檔期調整；現場展覽、票價與開放空間以館方公告為準。",
    mapQuery: "嘉義市立博物館",
    area: "B",
    mission: true,
    durationMin: 80,
    stay: "14:58-16:18",
    travelFromPreviousMin: 20,
    attachments: [
      { label: "Google 地點", url: mapSearchUrl("嘉義市立博物館") },
      { label: "博物館官網", url: "https://museum.chiayi.gov.tw/" },
    ],
  },
  {
    id: "wood-lab",
    time: "16:23",
    type: "踩點",
    title: "嘉義製材所園區 / 嘉義實驗木場",
    desc: "可領金色花苗與明信片。",
    reward: "五金行 Decor",
    suggestion: "看阿里山林業在市區留下的產業現場：製材工場、動力室、鋸屑室、乾燥室，理解嘉義「木都」怎麼從阿里山鐵道接到市區。",
    note: "以戶外與歷史建築為主；雨天或高溫時現場體感會明顯影響停留品質。",
    mapQuery: "嘉義製材所園區 嘉義實驗木場",
    area: "B",
    mission: true,
    durationMin: 20,
    stay: "16:23-16:43",
    travelFromPreviousMin: 5,
    attachments: [
      { label: "Google 地點", url: mapSearchUrl("嘉義製材所園區 嘉義實驗木場") },
      { label: "活動資訊", url: officialEventUrl },
    ],
  },
  {
    id: "literature-museum",
    time: "17:23",
    type: "踩點",
    title: "嘉義文學館：東門町1923",
    desc: "可領金色花苗與明信片。",
    reward: "圖書館 Decor",
    suggestion: "看百年東門派出所再生的文學基地；2026 首展《球者魂也：嘉義棒球文學特展》把展場做成球場，用文學看 KANO 與嘉義棒球原鄉。",
    note: "《球者魂也》公開資訊標示展期至 2026/07/12；實際開館與入場以嘉義文學館公告為準。",
    mapQuery: "嘉義文學館 東門町1923",
    area: "C",
    mission: true,
    durationMin: 5,
    stay: "17:23-17:28",
    travelFromPreviousMin: 10,
    attachments: [
      { label: "Google 地點", url: mapSearchUrl("嘉義文學館 東門町1923") },
      { label: "活動資訊", url: officialEventUrl },
    ],
  },
  {
    id: "baseball-stadium",
    time: "17:03",
    type: "踩點",
    title: "嘉義市立棒球場",
    desc: "可領金色花苗與明信片。",
    reward: "體育館 Decor",
    suggestion: "外圍看嘉義棒球脈絡與 KANO 記憶；嘉義市立棒球場源自日治時期公園球場，和嘉義「棒球原鄉」形象很直接。",
    note: "若沒有比賽或活動，不預設能入場參觀；以外圍與周邊公共空間為主。",
    mapQuery: "嘉義市立棒球場",
    area: "C",
    mission: true,
    durationMin: 10,
    stay: "17:03-17:13",
    travelFromPreviousMin: 20,
    attachments: [
      { label: "Google 地點", url: mapSearchUrl("嘉義市立棒球場") },
      { label: "活動資訊", url: officialEventUrl },
    ],
  },
  {
    id: "culture-park",
    time: "11:43",
    type: "踩點",
    title: "文化公園",
    desc: "可領金色花苗與明信片。",
    reward: "公園（四葉幸運草）Decor",
    suggestion: "5/30-5/31 15:00-21:00 官方地圖與遮陽帽發放攤位在這裡；有到攤位就先確認領取規則。",
    note: "官方公告說實體攤位只在 5/30-5/31 15:00-21:00；不在攤位時段也仍可玩遊戲 Special Spot。",
    mapQuery: "嘉義文化公園",
    area: "C",
    mission: true,
    durationMin: 30,
    stay: "11:43-12:13",
    travelFromPreviousMin: 15,
    attachments: [
      { label: "Google 地點", url: mapSearchUrl("嘉義文化公園") },
      { label: "官方活動公告", url: officialEventUrl },
    ],
  },
  {
    id: "central-market",
    time: "11:13",
    type: "踩點",
    title: "嘉義中央第一商場",
    desc: "可領金色花苗與明信片。",
    reward: "服裝店 Decor",
    suggestion: "拿服裝店 Decor，順便看商場與文化路周邊街區氛圍。",
    note: "中央第一商場屬市中心商場環境，傍晚周邊人流通常會增加。",
    mapQuery: "嘉義中央第一商場",
    area: "C",
    mission: true,
    durationMin: 15,
    stay: "11:13-11:28",
    travelFromPreviousMin: 10,
    attachments: [
      { label: "Google 地點", url: mapSearchUrl("嘉義中央第一商場") },
      { label: "前往文化路", url: mapSearchUrl("嘉義中央第一商場 到 文化路夜市") },
    ],
  },
  {
    id: "wenhua-dinner",
    time: "17:33",
    type: "晚餐",
    title: "文化路夜市 / 文化路晚餐",
    desc: "",
    reward: "晚餐收束",
    suggestion: "吃飯、休息、整理戰利品。",
    note: "文化路晚餐店家選擇多；熱門店可能需要排隊。",
    mapQuery: "嘉義文化路夜市",
    area: "C",
    locked: true,
    durationMin: 70,
    stay: "17:33-18:43",
    travelFromPreviousMin: 5,
    attachments: [
      { label: "晚餐地圖", url: mapSearchUrl("嘉義文化路夜市 晚餐") },
      { label: "甜點飲料", url: mapSearchUrl("嘉義文化路夜市 甜點 飲料") },
    ],
  },
  {
    id: "return-brt",
    time: "19:23",
    type: "BRT 返程",
    title: "文化路 / 嘉義市區 → 高鐵嘉義站",
    desc: "",
    reward: "返程緩衝",
    suggestion: "回高鐵站，保守抓候車、進站與走路時間。",
    note: "回程高鐵 678 是嘉義 19:32 發車。",
    mapQuery: "嘉義文化路夜市 到 高鐵嘉義站",
    area: "gateway",
    locked: true,
    durationMin: 5,
    stay: "19:23-19:28",
    travelFromPreviousMin: 40,
    attachments: [
      { label: "返程地圖", url: mapSearchUrl("嘉義文化路夜市 到 高鐵嘉義站") },
    ],
  },
  {
    id: "return-train",
    time: "19:32",
    type: "高鐵回程",
    title: "高鐵 678｜嘉義 → 台北",
    desc: "",
    reward: "回台北",
    suggestion: "19:32 從嘉義上車，20:59 抵達台北。",
    note: "票面資訊：2026/05/30，嘉義 19:32 → 台北 20:59。",
    mapQuery: "高鐵嘉義站",
    area: "gateway",
    locked: true,
    durationMin: 0,
    stay: "19:32",
    travelFromPreviousMin: 0,
    attachments: [
      { label: "高鐵嘉義站", url: mapSearchUrl("高鐵嘉義站") },
    ],
  },
];

const DEFAULT_STOP_ORDER = [
  "hsr",
  "lunch",
  "central-market",
  "culture-park",
  "art-museum",
  "creative-park",
  "city-museum",
  "wood-lab",
  "baseball-stadium",
  "literature-museum",
  "wenhua-dinner",
  "return-brt",
  "return-train",
];

const dessertStops: DessertStop[] = [
  {
    name: "一銀仙草創始店",
    area: "文化路/中正路",
    address: "嘉義市西區中正路525號",
    timing: "雨勢變大或文化路晚餐後",
    rainPlan: "離文化路很近，適合當不用長距離移動的甜湯備案。",
    signature: "仙草、豆花、雞蛋糕",
    mapQuery: "一銀仙草創始店 嘉義市西區中正路525號",
    mapX: 44,
    mapY: 70,
    sourceName: "輕旅行",
    sourceUrl: "https://travel.yam.com/article/129185",
  },
  {
    name: "聖塔咖啡",
    area: "文化公園旁",
    address: "嘉義市東區興中街10號",
    timing: "17:10 文化公園前後躲雨",
    rainPlan: "就在文化公園旁，行程被雨切斷時可以直接轉進室內休息。",
    signature: "手作甜點、咖啡、蛋捲",
    mapQuery: "聖塔咖啡 嘉義市東區興中街10號",
    mapX: 56,
    mapY: 56,
    sourceName: "輕旅行",
    sourceUrl: "https://travel.yam.com/article/129185",
  },
  {
    name: "霜空珈琲",
    area: "國華街",
    address: "嘉義市西區國華街132號",
    timing: "美術館後或午後雨備",
    rainPlan: "國華街老宅咖啡，若下午開始下雨，適合替換掉戶外停留較重的站點。",
    signature: "點心盤、布丁、季節甜點",
    mapQuery: "霜空珈琲 嘉義市西區國華街132號",
    mapX: 33,
    mapY: 42,
    sourceName: "輕旅行/美食紀錄",
    sourceUrl: "https://travel.yam.com/article/110723",
  },
  {
    name: "點。甜點 SweetFarm",
    area: "民權路",
    address: "嘉義市東區民權路300-3號",
    timing: "博物館前後的精緻甜點備案",
    rainPlan: "法式甜點專門店，適合雨停前坐下來分配後續踩點順序。",
    signature: "法式蛋糕、鹹派、閃電泡芙",
    mapQuery: "點。甜點 SweetFarm 嘉義市東區民權路300-3號",
    mapX: 63,
    mapY: 38,
    sourceName: "輕旅行",
    sourceUrl: "https://travel.yam.com/article/129185",
  },
  {
    name: "木更 MUGENERATION",
    area: "成仁街",
    address: "嘉義市東區成仁街189號",
    timing: "阿宏師後、或回到市中心時",
    rainPlan: "老房改造咖啡廳兼展覽空間，雨天可用來替代較短的戶外點。",
    signature: "戚風蛋糕、磅蛋糕、瑪德蓮",
    mapQuery: "木更 MUGENERATION 嘉義市東區成仁街189號",
    mapX: 52,
    mapY: 64,
    sourceName: "輕旅行",
    sourceUrl: "https://travel.yam.com/article/129185",
  },
  {
    name: "荏苒咖啡",
    area: "嘉義公園/棒球場旁",
    address: "嘉義市東區公園街97號",
    timing: "棒球場前後的最近躲雨點",
    rainPlan: "在嘉義公園旁，離棒球場動線近；若棒球場外圍遇雨，優先轉進這裡等雨停。",
    signature: "肉桂捲、生乳酪、季節蛋糕捲",
    mapQuery: "荏苒咖啡 嘉義市東區公園街97號",
    mapX: 70,
    mapY: 30,
    sourceName: "輕旅行",
    sourceUrl: "https://travel.yam.com/article/128837",
  },
  {
    name: "白日夢甜點、咖啡",
    area: "大雅路/棒球場東側",
    address: "嘉義市東區大雅路二段490巷2號",
    timing: "棒球場後的甜點撤退點",
    rainPlan: "大雅路巷弄甜點店，適合把棒球場短停後的雨備時間轉成坐下休息。",
    signature: "水果塔、生乳甜點、冰沙",
    mapQuery: "白日夢甜點咖啡 嘉義市東區大雅路二段490巷2號",
    mapX: 82,
    mapY: 36,
    sourceName: "靠北餐廳",
    sourceUrl: "https://needmorefood.com/5QYA.html",
  },
];

const potionStops: PotionStop[] = [
  {
    name: "源興御香屋",
    area: "文化路/圓環",
    pick: "葡萄柚綠茶",
    mapQuery: "源興御香屋 嘉義市西區中山路321號",
  },
  {
    name: "TEA'S 原味 嘉市文化店",
    area: "文化路",
    pick: "嘉義起家手搖茶",
    mapQuery: "TEA'S原味 嘉市文化店 嘉義市東區文化路164號",
  },
  {
    name: "杜芳子古味茶鋪 嘉義文化店",
    area: "文化路",
    pick: "古味茶飲",
    mapQuery: "杜芳子古味茶鋪 嘉義文化店 嘉義市西區文化路161號",
  },
  {
    name: "50嵐 嘉義文化店",
    area: "文化路",
    pick: "四季春、珍波椰",
    mapQuery: "50嵐 嘉義文化店 嘉義市東區文化路190號",
  },
  {
    name: "龜記茗品 嘉義文化店",
    area: "文化路",
    pick: "紅柚翡翠、柳丁翡翠",
    mapQuery: "龜記茗品 嘉義文化店 嘉義市東區文化路174號",
  },
  {
    name: "鮮茶道 嘉義文化店",
    area: "文化路/文化公園",
    pick: "珍珠奶茶、茶飲",
    mapQuery: "鮮茶道 嘉義文化店 嘉義市東區文化路172號",
  },
  {
    name: "可不可熟成紅茶 嘉義民族店",
    area: "民族路/東門町",
    pick: "熟成紅茶、白玉歐蕾",
    mapQuery: "可不可熟成紅茶 嘉義民族店 嘉義市西區民族路463號",
  },
  {
    name: "一沐日 嘉義中山店",
    area: "中山路/車站動線",
    pick: "粉粿茶飲、鮮奶茶",
    mapQuery: "一沐日 嘉義中山店 嘉義市西區中山路377號",
  },
  {
    name: "麻古茶坊 嘉義秀泰店",
    area: "文化路/秀泰",
    pick: "果粒茶、芝芝系列",
    mapQuery: "麻古茶坊 嘉義秀泰店 嘉義市西區文化路291號",
  },
  {
    name: "Tea's原味 嘉市大雅店",
    area: "棒球場東側/大雅路",
    pick: "手搖茶",
    mapQuery: "Tea's原味 嘉市大雅店 嘉義市東區大雅路二段613號",
  },
];

export function meta() {
  return [
    { title: "嘉義皮克敏踩點行程" },
    {
      name: "description",
      content: "以嘉義皮克敏 8 個特殊地點與展館停留為主的半日行程。",
    },
  ];
}

function getStoredCompleted() {
  if (typeof window === "undefined") return new Set<string>();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return new Set(Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : []);
  } catch {
    return new Set<string>();
  }
}

function getDefaultOrder() {
  return DEFAULT_STOP_ORDER;
}

function getStoredOrder() {
  if (typeof window === "undefined") return getDefaultOrder();
  try {
    const defaultOrder = getDefaultOrder();
    const raw = window.localStorage.getItem(ORDER_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(parsed)) return defaultOrder;
    const validIds = new Set(defaultOrder);
    const ordered = parsed.filter((item): item is string => typeof item === "string" && validIds.has(item));
    const missing = defaultOrder.filter((id) => !ordered.includes(id));
    const merged = [...ordered, ...missing];
    const lockedPositionsOk = stops.every((stop) => !stop.locked || merged.indexOf(stop.id) === defaultOrder.indexOf(stop.id));
    return lockedPositionsOk ? merged : defaultOrder;
  } catch {
    return getDefaultOrder();
  }
}

function saveOrder(next: string[]) {
  window.localStorage.setItem(ORDER_STORAGE_KEY, JSON.stringify(next));
}

function currentLocationRouteUrl(stop: Stop) {
  const travelMode = stop.area === "gateway" ? "transit" : "bicycling";
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(stop.mapQuery)}&travelmode=${travelMode}`;
}

function fullRouteUrl(routeStops: Stop[]) {
  const origin = routeStops[0];
  const destination = routeStops[routeStops.length - 1];
  const waypoints = routeStops.slice(1, -1).map((stop) => stop.mapQuery).join("|");
  return `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(origin.mapQuery)}&destination=${encodeURIComponent(destination.mapQuery)}&waypoints=${encodeURIComponent(waypoints)}&travelmode=bicycling`;
}

function timeToMinutes(time: string) {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

function minutesToTime(totalMinutes: number) {
  const normalized = ((totalMinutes % 1440) + 1440) % 1440;
  const hours = Math.floor(normalized / 60).toString().padStart(2, "0");
  const minutes = (normalized % 60).toString().padStart(2, "0");
  return `${hours}:${minutes}`;
}

function formatDuration(minutes: number) {
  const abs = Math.abs(minutes);
  const hours = Math.floor(abs / 60);
  const mins = abs % 60;
  if (hours === 0) return `${mins} 分`;
  if (mins === 0) return `${hours} 小時`;
  return `${hours} 小時 ${mins} 分`;
}

function estimateTravelMinutes(from?: Stop, to?: Stop) {
  if (!from || !to || from.id === to.id) return 0;
  const defaultToIndex = DEFAULT_STOP_ORDER.indexOf(to.id);
  if (to.travelFromPreviousMin !== undefined && DEFAULT_STOP_ORDER[defaultToIndex - 1] === from.id) {
    return to.travelFromPreviousMin;
  }
  if (from.id === "hsr") return 35;
  if (to.id === "return-train") return 0;
  if (to.id === "return-brt") return 40;
  if (from.area === "gateway" || to.area === "gateway") return 35;
  if (from.area === to.area) return 5;
  const pair = new Set([from.area, to.area]);
  if (pair.has("A") && pair.has("C")) return 30;
  return 20;
}

function buildSchedule(orderedStops: Stop[]) {
  const schedule = new Map<string, { start: string; end: string; stay: string }>();
  let cursor = timeToMinutes("09:13");

  orderedStops.forEach((stop, index) => {
    const previous = orderedStops[index - 1];
    if (previous) cursor += estimateTravelMinutes(previous, stop);
    if (stop.id === "wenhua-dinner") cursor = Math.max(cursor, timeToMinutes("17:30"));
    if (stop.id === "return-brt") cursor = Math.max(cursor, timeToMinutes("18:45"));
    if (stop.id === "return-train") cursor = Math.max(cursor, timeToMinutes("19:32"));

    const start = minutesToTime(cursor);
    const end = minutesToTime(cursor + stop.durationMin);
    const stay = stop.durationMin > 0 ? `${start}-${end}` : start;
    schedule.set(stop.id, { start, end, stay });
    cursor += stop.durationMin;
  });

  return schedule;
}

function saveCompleted(next: Set<string>) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify([...next]));
}

function getNodeLabel(index: number) {
  return `遭遇點 ${String(index + 1).padStart(2, "0")}`;
}

function getControlStats(missionProgress: number, missionTotal: number) {
  const obedience = Math.min(96, 64 + missionProgress * 4);
  const resistance = missionProgress >= 6 ? "低" : missionProgress >= 3 ? "中" : "偏高";
  const rewrite = missionProgress === 0 ? "待命" : missionProgress >= missionTotal ? "自然化完成" : "ACTIVE";
  const depth = Math.min(8, Math.max(2, missionProgress + 2));
  return { obedience, resistance, rewrite, depth };
}

export default function ChiayiPikminPage() {
  const [completed, setCompleted] = useState<Set<string>>(() => new Set<string>());
  const [order, setOrder] = useState<string[]>(() => getDefaultOrder());
  const [hasMounted, setHasMounted] = useState(false);
  const [currentTime, setCurrentTime] = useState("09:13");
  const [travelEstimate, setTravelEstimate] = useState(0);
  const [openStopId, setOpenStopId] = useState<string | null>(null);
  const [commandTarget, setCommandTarget] = useState<Stop | null>(null);
  const [draggingStopId, setDraggingStopId] = useState<string | null>(null);
  const [dragOverStopId, setDragOverStopId] = useState<string | null>(null);

  useEffect(() => {
    document.title = "嘉義皮克敏踩點行程";
    setCompleted(getStoredCompleted());
    setOrder(getStoredOrder());
    setHasMounted(true);
  }, []);

  const orderedStops = useMemo(() => {
    const stopById = new Map(stops.map((stop) => [stop.id, stop]));
    return order.map((id) => stopById.get(id)).filter((stop): stop is Stop => Boolean(stop));
  }, [order]);
  const scheduleById = useMemo(() => buildSchedule(orderedStops), [orderedStops]);
  const missionStops = useMemo(() => orderedStops.filter((stop) => stop.mission), [orderedStops]);
  const firstOpen = useMemo(
    () => orderedStops.find((stop) => stop.id !== "hsr" && !completed.has(stop.id)),
    [completed, orderedStops],
  );
  const firstOpenIndex = firstOpen ? orderedStops.findIndex((stop) => stop.id === firstOpen.id) : -1;
  const previousStop = firstOpenIndex > 0 ? orderedStops[firstOpenIndex - 1] : undefined;
  const missionProgress = hasMounted ? missionStops.filter((stop) => completed.has(stop.id)).length : 0;
  const progressPercent = (missionProgress / missionStops.length) * 100;
  const overallMap = fullRouteUrl(orderedStops);
  const nextTravelEstimate = estimateTravelMinutes(previousStop, firstOpen);
  const firstOpenSchedule = firstOpen ? scheduleById.get(firstOpen.id) : undefined;
  const scheduledMinutes = firstOpenSchedule ? timeToMinutes(firstOpenSchedule.start) : timeToMinutes("17:30");
  const nowMinutes = timeToMinutes(currentTime);
  const scheduleGap = scheduledMinutes - nowMinutes;
  const leaveGap = scheduleGap - travelEstimate;
  const targetArrival = minutesToTime(nowMinutes + travelEstimate);

  useEffect(() => {
    setTravelEstimate(nextTravelEstimate);
  }, [nextTravelEstimate, firstOpen?.id]);

  const scheduleMessage = !firstOpen
    ? "今日行程已完成"
    : scheduleGap >= 0
      ? `距表定 ${formatDuration(scheduleGap)}`
      : `已晚 ${formatDuration(scheduleGap)}`;

  const leaveMessage = !firstOpen
    ? "可以放鬆吃飯了"
    : travelEstimate <= 0
      ? "出發整備中"
      : leaveGap > 0
        ? `${formatDuration(leaveGap)} 後出發`
        : "現在該往下一站移動";

  const toggleStop = (stopId: string) => {
    setOpenStopId(null);
    setCompleted((current) => {
      const next = new Set(current);
      if (next.has(stopId)) {
        next.delete(stopId);
      } else {
        next.add(stopId);
      }
      saveCompleted(next);
      return next;
    });
  };

  const resetMission = () => {
    window.localStorage.removeItem(STORAGE_KEY);
    window.localStorage.removeItem(ORDER_STORAGE_KEY);
    setCompleted(new Set<string>());
    setOrder(getDefaultOrder());
  };

  const moveStop = (stopId: string, direction: -1 | 1) => {
    setOrder((current) => {
      const currentIndex = current.indexOf(stopId);
      if (currentIndex < 0) return current;
      const stop = stops.find((item) => item.id === stopId);
      if (!stop || stop.locked) return current;

      let targetIndex = currentIndex + direction;
      while (targetIndex >= 0 && targetIndex < current.length) {
        const targetStop = stops.find((item) => item.id === current[targetIndex]);
        if (targetStop && !targetStop.locked) {
          const next = [...current];
          [next[currentIndex], next[targetIndex]] = [next[targetIndex], next[currentIndex]];
          saveOrder(next);
          return next;
        }
        targetIndex += direction;
      }
      return current;
    });
  };

  const isReorderable = (stopId: string) => {
    const stop = stops.find((item) => item.id === stopId);
    return Boolean(stop && !stop.locked);
  };

  const reorderStop = (activeId: string, targetId: string) => {
    if (activeId === targetId || !isReorderable(activeId) || !isReorderable(targetId)) return;
    setOrder((current) => {
      const activeIndex = current.indexOf(activeId);
      const targetIndex = current.indexOf(targetId);
      if (activeIndex < 0 || targetIndex < 0) return current;
      const next = [...current];
      next.splice(activeIndex, 1);
      next.splice(targetIndex, 0, activeId);
      saveOrder(next);
      return next;
    });
  };

  const getStopIdFromPoint = (clientX: number, clientY: number) => {
    const element = document.elementFromPoint(clientX, clientY);
    return element?.closest<HTMLElement>("[data-stop-id]")?.dataset.stopId ?? null;
  };

  const canMoveStop = (stopId: string, direction: -1 | 1) => {
    const currentIndex = order.indexOf(stopId);
    const stop = stops.find((item) => item.id === stopId);
    if (currentIndex < 0 || !stop || stop.locked) return false;
    let targetIndex = currentIndex + direction;
    while (targetIndex >= 0 && targetIndex < order.length) {
      const targetStop = stops.find((item) => item.id === order[targetIndex]);
      if (targetStop && !targetStop.locked) return true;
      targetIndex += direction;
    }
    return false;
  };

  const openNextStop = () => {
    if (firstOpen) {
      setCommandTarget(firstOpen);
      return;
    }
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const executeCommand = (stop: Stop) => {
    setCommandTarget(null);
    window.open(currentLocationRouteUrl(stop), "_blank", "noopener,noreferrer");
  };

  return (
    <div className="chiayi-pikmin-page">
      <style>{chiayiPikminCss}</style>
      <main className="chiayi-pikmin-app">
        <header className="chiayi-pikmin-hero">
          <section className="chiayi-pikmin-hero-card">
            <div className="chiayi-pikmin-control-title">
              <span>PIKMIN CONTROL ROUTINE</span>
              <h1>今日支配行程</h1>
              <p>8 景點 / 8 暗示</p>
            </div>
            <div className="chiayi-pikmin-dashboard-top">
              <div>
                <span className="chiayi-pikmin-kicker">目標鎖定</span>
                <strong>
                  {firstOpen ? (
                    <>
                      <span>{firstOpenSchedule?.start ?? firstOpen.time}</span>
                      <span>{firstOpen.title}</span>
                    </>
                  ) : (
                    "今日踩點完成"
                  )}
                </strong>
              </div>
              <span className="chiayi-pikmin-progress-pill">支配率 {missionProgress}/{missionStops.length}</span>
              <button className="chiayi-pikmin-mini-btn" type="button" onClick={openNextStop}>
                <img src="/chiayi-pikmin/blue-pikmin.webp" alt="" />
                <span>執行指令</span>
              </button>
            </div>

            <div className="chiayi-pikmin-mission-row" aria-label="特殊地點收集進度">
              <div className="chiayi-pikmin-bar">
                <span style={{ width: `${progressPercent}%` }} />
                <div className="chiayi-pikmin-planters" aria-hidden="true">
                  {missionStops.map((stop, index) => {
                    const isFound = completed.has(stop.id);
                    const isCurrent = firstOpen?.id === stop.id;
                    const left = missionStops.length > 1 ? (index / (missionStops.length - 1)) * 100 : 0;
                    return (
                      <span
                        key={stop.id}
                        className={`chiayi-pikmin-planter ${isFound ? "found" : ""} ${isCurrent ? "current" : ""}`}
                        style={{ left: `${left}%` }}
                      >
                        <i />
                      </span>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="chiayi-pikmin-time-tool">
              <label>
                現在
                <input type="time" value={currentTime} onChange={(event) => setCurrentTime(event.target.value)} />
              </label>
              <label>
                移動
                <input
                  type="number"
                  inputMode="numeric"
                  min="0"
                  max="120"
                  value={travelEstimate}
                  onChange={(event) => setTravelEstimate(Number(event.target.value))}
                />
                <span>分</span>
              </label>
            </div>

            <div className="chiayi-pikmin-quick-read">
              <span className={scheduleGap < 0 ? "chiayi-pikmin-drift late" : "chiayi-pikmin-drift"}>{scheduleMessage}</span>
              <span>{previousStop ? `${areaLabels[previousStop.area]}→${firstOpen ? areaLabels[firstOpen.area] : ""}` : areaLabels[firstOpen?.area ?? "gateway"]}</span>
              <span>騎乘/轉乘 {travelEstimate} 分，估 {targetArrival} 到</span>
              <b>{leaveMessage}</b>
            </div>
          </section>
        </header>

        <div className="chiayi-pikmin-section-title">今日支配計畫</div>
        <section className="chiayi-pikmin-timeline">
          {orderedStops.map((stop, stopIndex) => {
            const isDone = completed.has(stop.id);
            const isCurrent = firstOpen?.id === stop.id;
            const missionIndex = stop.mission ? missionStops.findIndex((missionStop) => missionStop.id === stop.id) : -1;
            const pikminSrc = missionIndex >= 0 ? pikminImages[missionIndex % pikminImages.length] : null;
            const schedule = scheduleById.get(stop.id);
            const canDrag = isReorderable(stop.id);
            const nodeLabel = missionIndex >= 0 ? getNodeLabel(missionIndex) : `支援點 ${String(stopIndex + 1).padStart(2, "0")}`;
            const obedience = Math.min(96, 58 + Math.max(missionIndex, 0) * 5 + (isDone ? 18 : 0));
            const resistance = isDone ? "已解除" : isCurrent ? "中" : stop.locked ? "低" : "低";
            return (
              <article
                key={stop.id}
                data-stop-id={stop.id}
                className={`chiayi-pikmin-stop ${isDone ? "done" : ""} ${isCurrent ? "current" : ""} ${stop.mission ? "mission" : "support"} ${draggingStopId === stop.id ? "dragging" : ""} ${dragOverStopId === stop.id ? "drag-over" : ""}`}
                onDragOver={(event) => {
                  if (!draggingStopId || !canDrag) return;
                  event.preventDefault();
                  setDragOverStopId(stop.id);
                }}
                onDrop={(event) => {
                  event.preventDefault();
                  const activeId = event.dataTransfer.getData("text/plain") || draggingStopId;
                  if (activeId) reorderStop(activeId, stop.id);
                  setDraggingStopId(null);
                  setDragOverStopId(null);
                }}
              >
                <div className="chiayi-pikmin-card">
                  <div className="chiayi-pikmin-card-main">
                    <div className="chiayi-pikmin-meta">
                      <span className="chiayi-pikmin-time">{schedule?.start ?? stop.time}</span>
                      <span className="chiayi-pikmin-tag">{stop.type}</span>
                      <span className="chiayi-pikmin-tag stay">{schedule?.stay ?? stop.stay}</span>
                      <span className="chiayi-pikmin-tag zone">{areaLabels[stop.area]}</span>
                      {isCurrent ? <span className="chiayi-pikmin-tag current-tag">目標鎖定</span> : null}
                    </div>
                    <div className="chiayi-pikmin-node-code">
                      <span>{nodeLabel}</span>
                      <em>{isDone ? "記憶已覆寫" : isCurrent ? "認知改寫中" : "等待暗示"}</em>
                    </div>
                    <div className="chiayi-pikmin-title-row">
                      <button
                        className="chiayi-pikmin-drag-handle"
                        type="button"
                        draggable={canDrag}
                        disabled={!canDrag}
                        aria-label={canDrag ? `拖曳重排行程：${stop.title}` : `${stop.title} 固定，不可拖曳`}
                        onDragStart={(event) => {
                          if (!canDrag) return;
                          event.dataTransfer.effectAllowed = "move";
                          event.dataTransfer.setData("text/plain", stop.id);
                          setDraggingStopId(stop.id);
                        }}
                        onDragEnd={() => {
                          setDraggingStopId(null);
                          setDragOverStopId(null);
                        }}
                        onPointerDown={(event) => {
                          if (!canDrag) return;
                          event.preventDefault();
                          event.currentTarget.setPointerCapture(event.pointerId);
                          setDraggingStopId(stop.id);
                        }}
                        onPointerMove={(event) => {
                          if (!canDrag) return;
                          const targetId = getStopIdFromPoint(event.clientX, event.clientY);
                          setDragOverStopId(targetId && isReorderable(targetId) ? targetId : null);
                        }}
                        onPointerUp={(event) => {
                          if (!canDrag) return;
                          const targetId = getStopIdFromPoint(event.clientX, event.clientY);
                          if (targetId) reorderStop(stop.id, targetId);
                          setDraggingStopId(null);
                          setDragOverStopId(null);
                        }}
                        onPointerCancel={() => {
                          setDraggingStopId(null);
                          setDragOverStopId(null);
                        }}
                      >
                        <span />
                        <span />
                        <span />
                      </button>
                      <div className="chiayi-pikmin-stop-title">
                        {pikminSrc ? <img src={pikminSrc} alt="" aria-hidden="true" /> : null}
                        <h2>{stop.title}</h2>
                      </div>
                      <button
                        className="chiayi-pikmin-check"
                        type="button"
                        aria-label={`切換 ${stop.title} 完成狀態`}
                        onClick={() => toggleStop(stop.id)}
                      >
                        {isDone ? "完成" : "收編"}
                      </button>
                    </div>
                    <div className="chiayi-pikmin-front-actions">
                      <a className="chiayi-pikmin-action" href={mapSearchUrl(stop.mapQuery)} target="_blank" rel="noreferrer">
                        查看座標
                      </a>
                      <button className="chiayi-pikmin-action primary" type="button" onClick={() => setCommandTarget(stop)}>
                        <img src="/chiayi-pikmin/blue-pikmin.webp" alt="" />
                        <span>執行指令</span>
                      </button>
                    </div>
                  </div>

                  <details
                    open={openStopId === stop.id}
                    onToggle={(event) => {
                      const isOpen = event.currentTarget.open;
                      setOpenStopId((current) => {
                        if (isOpen) return stop.id;
                        return current === stop.id ? null : current;
                      });
                    }}
                  >
                    <summary>{isCurrent ? "查看服從狀態與指令" : "展開暗示指令"}</summary>
                    <div className="chiayi-pikmin-detail-grid">
                      <div className="chiayi-pikmin-control-readout">
                        <span>
                          <b>服從度</b>
                          {obedience}%
                        </span>
                        <span>
                          <b>抵抗值</b>
                          {resistance}
                        </span>
                        <span>
                          <b>暗示深度</b>
                          Lv.{Math.min(8, Math.max(2, missionIndex + 2))}
                        </span>
                      </div>
                      {stop.mission ? (
                        <div>
                          <b>採集命令</b>
                          {isDone ? "花苗已收編：" : ""}Special Spot：{stop.reward}。{stop.desc}
                        </div>
                      ) : null}
                      {stop.suggestion ? (
                        <div>
                          <b>{stop.mission ? "行動指令" : "支援指令"}</b>
                          {stop.suggestion}
                        </div>
                      ) : null}
                      <div>
                        <b>記憶處理</b>
                        本次行動將被自然化為「自己想去散步與採集花苗」。
                      </div>
                      {stop.note ? (
                        <div>
                          <b>系統警告</b>
                          {stop.note}
                        </div>
                      ) : null}
                      <div className="chiayi-pikmin-reorder">
                        <span>{stop.locked ? "固定控制節點，不參與重排" : `重排後會用 ${areaLabels[stop.area]} 的區域粗估重新計時`}</span>
                        <button type="button" disabled={!canMoveStop(stop.id, -1)} onClick={() => moveStop(stop.id, -1)}>
                          提前暗示
                        </button>
                        <button type="button" disabled={!canMoveStop(stop.id, 1)} onClick={() => moveStop(stop.id, 1)}>
                          延後暗示
                        </button>
                      </div>
                    </div>
                  </details>
                </div>
              </article>
            );
          })}
        </section>

        <div className="chiayi-pikmin-section-title">甜蜜誘惑</div>
        <details className="chiayi-pikmin-dessert-panel" aria-label="雨天甜點備案">
          <summary className="chiayi-pikmin-dessert-panel-summary">
            <span>
              <b>甜點誘惑</b>
              <small>7 間甜點，必要時展開誘惑路線</small>
            </span>
          </summary>
          <div className="chiayi-pikmin-dessert-content">
            <div className="chiayi-pikmin-rain-brief">
              <span>RAIN MODE</span>
              <b>明日午後若下雨，優先保留阿宏師與主要 Special Spot；甜點作為躲雨、充電、重排路線的緩衝站。</b>
            </div>
            <a className="chiayi-pikmin-batch-map" href={multiPointMapUrl(dessertStops)} target="_blank" rel="noreferrer">
              一次標記 7 個甜點誘惑
            </a>
            <div className="chiayi-pikmin-dessert-list">
              {dessertStops.map((dessert, index) => (
              <details className="chiayi-pikmin-dessert-card" key={dessert.name}>
                <summary>
                  <span className="chiayi-pikmin-map-pin">{index + 1}</span>
                  <span>
                    <b>{dessert.name}</b>
                    <small>{dessert.area}｜{dessert.timing}</small>
                  </span>
                </summary>
                <div className="chiayi-pikmin-dessert-body">
                  <p>
                    <b>甜點訊號</b>
                    {dessert.signature}
                  </p>
                  <p>
                    <b>雨備用途</b>
                    {dessert.rainPlan}
                  </p>
                  <p>
                    <b>位置</b>
                    {dessert.address}
                  </p>
                  <div className="chiayi-pikmin-map-frame" aria-label={`${dessert.name} 地圖`}>
                    <div className="chiayi-pikmin-map-surface">
                      <span className="chiayi-pikmin-map-road horizontal" />
                      <span className="chiayi-pikmin-map-road vertical" />
                      <span className="chiayi-pikmin-map-road diagonal" />
                      <span className="chiayi-pikmin-map-zone station">嘉義車站</span>
                      <span className="chiayi-pikmin-map-zone culture">文化路</span>
                      <span
                        className="chiayi-pikmin-map-target"
                        style={{ left: `${dessert.mapX}%`, top: `${dessert.mapY}%` }}
                      >
                        {index + 1}
                      </span>
                    </div>
                  </div>
                  <div className="chiayi-pikmin-actions">
                    <a className="chiayi-pikmin-action" href={mapSearchUrl(dessert.mapQuery)} target="_blank" rel="noreferrer">
                      彈出此點位置地圖
                    </a>
                    <a className="chiayi-pikmin-action primary" href={dessert.sourceUrl} target="_blank" rel="noreferrer">
                      參考：{dessert.sourceName}
                    </a>
                  </div>
                </div>
              </details>
              ))}
            </div>
          </div>
        </details>

        <div className="chiayi-pikmin-section-title">快樂藥水</div>
        <details className="chiayi-pikmin-dessert-panel chiayi-pikmin-potion-panel" aria-label="飲料清單">
          <summary className="chiayi-pikmin-dessert-panel-summary">
            <span>
              <b>快樂藥水</b>
              <small>10 個補水點，景點附近快速標記</small>
            </span>
          </summary>
          <div className="chiayi-pikmin-dessert-content">
            <div className="chiayi-pikmin-rain-brief">
              <span>POTION MODE</span>
              <b>全部改成手搖飲：想喝就開地圖，依當下位置挑最近的藥水補給。</b>
            </div>
            <a className="chiayi-pikmin-batch-map" href={multiPointMapUrl(potionStops)} target="_blank" rel="noreferrer">
              一次標記 10 個快樂藥水
            </a>
            <div className="chiayi-pikmin-potion-list">
              {potionStops.map((potion, index) => (
                <a className="chiayi-pikmin-potion-card" key={potion.name} href={mapSearchUrl(potion.mapQuery)} target="_blank" rel="noreferrer">
                  <span className="chiayi-pikmin-map-pin">{index + 1}</span>
                  <span>
                    <b>{potion.name}</b>
                    <small>{potion.area}｜{potion.pick}</small>
                  </span>
                </a>
              ))}
            </div>
          </div>
        </details>

        <div className="chiayi-pikmin-section-title">規則說明</div>
        <section className="chiayi-pikmin-note-card">
          <p>
            <b>車票：</b>{trainInfo.outbound}；{trainInfo.inbound}。
          </p>
          <p>
            <b>午餐：</b>抵達嘉義市區先去阿宏師火雞肉飯排隊，避開中午尖峰；吃完再回收美術館、文創園區與博物館三個主線點。
          </p>
          <p>
            <b>雨備：</b>午後若雨勢影響 Ubike 或戶外點，優先用甜點控制台替換短停點，保留文化公園與中央第一商場收尾。
          </p>
          <p>
            <b>預設路線：</b>先以阿宏師、展館停留與 17:30 文化路晚餐為基準排好；實際順序可拖曳調整，時間會依 A/B/C 分區重新粗估。
          </p>
          <p>
            <b>交通：</b>市區以 Ubike 粗估，A 車站西側、B 北門藝文、C 東門/文化路；同區抓 5 分，A-B / B-C 抓 20 分，A-C 抓 30 分，高鐵頭尾 BRT 固定處理。
          </p>
        </section>
      </main>

      <nav className="chiayi-pikmin-bottom-nav" aria-label="任務操作">
        <button className="light" type="button" onClick={resetMission}>
          重設記憶
        </button>
        <a className="dark" href={overallMap} target="_blank" rel="noreferrer">
          控制路線
        </a>
      </nav>
      {commandTarget ? (
        <div className="chiayi-pikmin-modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="chiayi-command-title">
          <section className="chiayi-pikmin-command-modal">
            <span className="chiayi-pikmin-modal-kicker">COMMAND CONFIRMATION</span>
            <h2 id="chiayi-command-title">是否執行本次支配行程？</h2>
            <p>
              目標將前往 <b>{commandTarget.title}</b>，並將此行為認知為「自主決定」。
            </p>
            <div className="chiayi-pikmin-modal-readout">
              <span>自我判斷：OFF</span>
              <span>自然化處理：ON</span>
              <span>採集命令：{commandTarget.reward}</span>
            </div>
            <div className="chiayi-pikmin-modal-actions">
              <button type="button" onClick={() => setCommandTarget(null)}>
                取消
              </button>
              <button type="button" onClick={() => executeCommand(commandTarget)}>
                執行指令
              </button>
              <button className="deep" type="button" onClick={() => executeCommand(commandTarget)}>
                深層執行
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </div>
  );
}

const chiayiPikminCss = `
.chiayi-pikmin-page {
  --cp-bg: #fff9df;
  --cp-card: #fffef7;
  --cp-text: #2f403f;
  --cp-muted: #71807a;
  --cp-line: #e8ddb5;
  --cp-leaf: #7fd0ca;
  --cp-leaf-dark: #2a7a78;
  --cp-leaf-soft: #e4fbf8;
  --cp-sun: #ffd45a;
  --cp-sun-soft: #fff3bd;
  --cp-red: #f06d5e;
  --cp-blue: #67a7e8;
  --cp-purple: #a887d5;
  --cp-shadow: 0 14px 34px rgba(55, 113, 111, 0.14);
  --cp-radius: 26px;
  min-height: 100vh;
  position: relative;
  color: var(--cp-text);
  background:
    radial-gradient(circle at 8% 5%, rgba(255, 216, 99, 0.5), transparent 28%),
    radial-gradient(circle at 100% 12%, rgba(127, 208, 202, 0.36), transparent 30%),
    linear-gradient(180deg, #fffdf1 0%, var(--cp-bg) 52%, #e7fbf8 100%);
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "Noto Sans TC", sans-serif;
}

.chiayi-pikmin-page *,
.chiayi-pikmin-page *::before,
.chiayi-pikmin-page *::after {
  box-sizing: border-box;
}

.chiayi-pikmin-app {
  position: relative;
  z-index: 1;
  width: min(430px, 100%);
  margin: 0 auto;
  padding: 8px 12px 90px;
}

.chiayi-pikmin-hero {
  position: sticky;
  top: 0;
  z-index: 100;
  padding: 6px 0 6px;
  background: linear-gradient(180deg, rgba(255,253,241,0.98), rgba(232,251,248,0.72));
  backdrop-filter: blur(16px);
}

.chiayi-pikmin-hero-card {
  position: relative;
  overflow: hidden;
  border-radius: 22px;
  padding: 8px;
  background: linear-gradient(145deg, rgba(255, 254, 247, 0.94), rgba(232, 251, 248, 0.76));
  border: 1px solid rgba(195, 232, 225, 0.92);
  box-shadow: var(--cp-shadow);
}

.chiayi-pikmin-hero-card::after {
  content: "";
  position: absolute;
  right: -30px;
  top: -20px;
  width: 130px;
  height: 130px;
  border-radius: 50%;
  background: radial-gradient(circle, rgba(127,208,202,0.45), rgba(255,212,90,0.08), rgba(255,212,90,0));
  pointer-events: none;
}

.chiayi-pikmin-dashboard-top {
  position: relative;
  z-index: 1;
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto auto;
  gap: 6px;
  align-items: center;
}

.chiayi-pikmin-dashboard-top div {
  min-width: 0;
}

.chiayi-pikmin-dashboard-top strong {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  gap: 6px;
  align-items: baseline;
  margin-top: 2px;
  color: var(--cp-leaf-dark);
  font-size: 13px;
  line-height: 1.25;
  font-weight: 950;
  white-space: normal;
}

.chiayi-pikmin-dashboard-top strong > span:first-child {
  color: #8f4d43;
  font-size: 13px;
}

.chiayi-pikmin-dashboard-top strong > span:last-child {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.chiayi-pikmin-dashboard-top .chiayi-pikmin-progress-pill {
  grid-column: auto;
  width: auto;
}

.chiayi-pikmin-kicker {
  display: block;
  color: var(--cp-muted);
  font-size: 12px;
  font-weight: 900;
}

.chiayi-pikmin-progress-pill {
  border-radius: 999px;
  background: var(--cp-sun-soft);
  color: #6e5b15;
  font-size: 12px;
  font-weight: 950;
  padding: 7px 8px;
  white-space: nowrap;
}

.chiayi-pikmin-eyebrow {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 13px;
  color: var(--cp-muted);
  margin-bottom: 8px;
  position: relative;
  z-index: 1;
}

.chiayi-pikmin-badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 5px 9px;
  border-radius: 999px;
  background: var(--cp-leaf-soft);
  color: var(--cp-leaf-dark);
  font-weight: 800;
}

.chiayi-pikmin-title {
  margin: 0;
  font-size: 25px;
  line-height: 1.18;
  letter-spacing: 0;
  position: relative;
  z-index: 1;
}

.chiayi-pikmin-subtitle {
  margin: 8px 0 15px;
  color: var(--cp-muted);
  font-size: 14px;
  line-height: 1.55;
  position: relative;
  z-index: 1;
}

.chiayi-pikmin-mission-row {
  margin: 7px 0 7px;
  position: relative;
  z-index: 1;
}

.chiayi-pikmin-mission-label,
.chiayi-pikmin-mission-count {
  font-size: 13px;
}

.chiayi-pikmin-mission-label {
  color: var(--cp-muted);
}

.chiayi-pikmin-mission-count {
  color: var(--cp-leaf-dark);
  font-weight: 900;
}

.chiayi-pikmin-bar {
  position: relative;
  height: 9px;
  margin: 0 10px;
  background: #eee4b7;
  border-radius: 999px;
  overflow: visible;
}

.chiayi-pikmin-bar > span {
  display: block;
  height: 100%;
  width: 0%;
  background: linear-gradient(90deg, var(--cp-leaf), #c9ece2, var(--cp-sun));
  border-radius: inherit;
  transition: width 0.35s ease;
  overflow: hidden;
}

.chiayi-pikmin-planters {
  position: absolute;
  inset: 0;
  pointer-events: none;
}

.chiayi-pikmin-planter {
  position: absolute;
  top: 50%;
  width: 18px;
  height: 20px;
  transform: translate(-50%, -42%);
  transform-origin: 50% 80%;
  transition: transform 0.2s ease, opacity 0.2s ease;
  opacity: 0.7;
}

.chiayi-pikmin-planter::before {
  content: "";
  position: absolute;
  left: 4px;
  right: 4px;
  bottom: 0;
  height: 8px;
  border-radius: 2px 2px 5px 5px;
  background: #c58a53;
  box-shadow: inset 0 -2px 0 rgba(77, 45, 20, 0.18), 0 1px 2px rgba(47, 64, 63, 0.12);
}

.chiayi-pikmin-planter::after {
  content: "";
  position: absolute;
  left: 3px;
  right: 3px;
  bottom: 7px;
  height: 4px;
  border-radius: 999px;
  background: #8b5f35;
}

.chiayi-pikmin-planter i {
  position: absolute;
  left: 8px;
  bottom: 10px;
  width: 2px;
  height: 8px;
  border-radius: 999px;
  background: #6d8b42;
}

.chiayi-pikmin-planter i::before,
.chiayi-pikmin-planter i::after {
  content: "";
  position: absolute;
  top: 0;
  width: 7px;
  height: 5px;
  border-radius: 80% 10% 80% 10%;
  background: #9fcf65;
}

.chiayi-pikmin-planter i::before {
  right: 1px;
  transform: rotate(-34deg);
  transform-origin: right bottom;
}

.chiayi-pikmin-planter i::after {
  left: 1px;
  transform: rotate(34deg) scaleX(-1);
  transform-origin: left bottom;
}

.chiayi-pikmin-planter.found {
  opacity: 1;
  transform: translate(-50%, -48%) scale(1.08);
}

.chiayi-pikmin-planter.found::before {
  background: #d6a05a;
}

.chiayi-pikmin-planter.found i,
.chiayi-pikmin-planter.found i::before,
.chiayi-pikmin-planter.found i::after {
  background: var(--cp-leaf-dark);
}

.chiayi-pikmin-planter.current {
  transform: translate(-50%, -54%) scale(1.16);
}

.chiayi-pikmin-planter.current::before {
  outline: 2px solid rgba(255, 212, 90, 0.8);
  outline-offset: 1px;
}

.chiayi-pikmin-now-box {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 10px;
  align-items: center;
  padding: 6px 8px;
  border-radius: 14px;
  background: linear-gradient(135deg, var(--cp-sun-soft), var(--cp-leaf-soft));
  position: relative;
  z-index: 1;
}

.chiayi-pikmin-now-box small {
  display: block;
  color: var(--cp-muted);
  font-size: 12px;
  margin-bottom: 0;
}

.chiayi-pikmin-now-box strong {
  display: block;
  min-width: 0;
  font-size: 13px;
  line-height: 1.25;
}

.chiayi-pikmin-drift {
  border-radius: 999px;
  background: rgba(255,255,255,0.72);
  color: var(--cp-leaf-dark);
  font-size: 11px;
  font-weight: 900;
  padding: 5px 7px;
  white-space: nowrap;
}

.chiayi-pikmin-drift.late {
  color: #b44c3f;
  background: rgba(255, 238, 219, 0.9);
}

.chiayi-pikmin-mini-btn {
  border: 0;
  border-radius: 999px;
  background: var(--cp-leaf-dark);
  color: white;
  padding: 8px 9px;
  font-size: 12px;
  font-weight: 900;
  white-space: nowrap;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.chiayi-pikmin-mini-btn img {
  width: 16px;
  height: 16px;
  object-fit: contain;
  margin: -3px 0;
}

.chiayi-pikmin-time-tool {
  position: relative;
  z-index: 1;
  display: grid;
  grid-template-columns: minmax(0, 1fr) 88px;
  gap: 5px;
  align-items: center;
  margin-top: 5px;
}

.chiayi-pikmin-time-tool label {
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 4px;
  min-height: 30px;
  padding: 4px 7px;
  border-radius: 12px;
  background: rgba(255,255,255,0.72);
  color: var(--cp-muted);
  font-size: 12px;
  font-weight: 900;
}

.chiayi-pikmin-time-tool input {
  min-width: 0;
  width: 100%;
  border: 0;
  background: transparent;
  color: var(--cp-text);
  font: inherit;
  font-size: 12px;
  height: 20px;
  outline: none;
}

.chiayi-pikmin-time-tool input[type="number"] {
  text-align: right;
}

.chiayi-pikmin-quick-read {
  position: relative;
  z-index: 1;
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
  margin-top: 4px;
  color: var(--cp-muted);
  font-size: 12px;
  font-weight: 800;
}

.chiayi-pikmin-quick-read b {
  color: var(--cp-text);
  font-size: 12px;
}

.chiayi-pikmin-train-line {
  position: relative;
  z-index: 1;
  display: grid;
  grid-template-columns: 1fr;
  gap: 2px;
  margin-top: 5px;
  color: var(--cp-muted);
  font-size: 11px;
  font-weight: 800;
}

.chiayi-pikmin-train-line span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.chiayi-pikmin-party {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 8px;
  position: relative;
  z-index: 1;
}

.chiayi-pikmin-seed {
  width: 22px;
  height: 22px;
  border-radius: 50% 50% 45% 45%;
  display: grid;
  place-items: center;
  color: #fff;
  font-size: 12px;
  font-weight: 900;
  box-shadow: inset 0 -4px 0 rgba(0,0,0,0.08);
  opacity: 0.32;
  transform: translateY(3px);
  transition: 0.25s ease;
}

.chiayi-pikmin-seed.found {
  opacity: 1;
  transform: translateY(0);
}

.chiayi-pikmin-seed.red { background: var(--cp-red); }
.chiayi-pikmin-seed.blue { background: var(--cp-blue); }
.chiayi-pikmin-seed.yellow { background: var(--cp-sun); color: #5b4b12; }
.chiayi-pikmin-seed.purple { background: var(--cp-purple); }

.chiayi-pikmin-section-title {
  margin: 14px 4px 8px;
  font-size: 13px;
  color: var(--cp-muted);
  font-weight: 900;
  letter-spacing: 0.05em;
}

.chiayi-pikmin-timeline {
  position: relative;
  padding-left: 14px;
}

.chiayi-pikmin-timeline::before {
  content: "";
  position: absolute;
  top: 8px;
  bottom: 14px;
  left: 5px;
  width: 2px;
  background: linear-gradient(180deg, var(--cp-leaf), var(--cp-sun-soft), var(--cp-line));
  border-radius: 99px;
}

.chiayi-pikmin-stop {
  position: relative;
  margin-bottom: 8px;
  transition: opacity 0.25s ease, transform 0.25s ease;
}

.chiayi-pikmin-stop::before {
  content: "";
  position: absolute;
  left: -14px;
  top: 18px;
  width: 11px;
  height: 11px;
  border-radius: 50%;
  background: var(--cp-card);
  border: 2px solid var(--cp-leaf);
  z-index: 2;
}

.chiayi-pikmin-stop.support::before {
  border-color: var(--cp-line);
}

.chiayi-pikmin-stop.done {
  opacity: 0.66;
}

.chiayi-pikmin-stop.done::before {
  background: var(--cp-leaf);
}

.chiayi-pikmin-stop.current .chiayi-pikmin-card {
  outline: 2px solid rgba(127, 208, 202, 0.46);
}

.chiayi-pikmin-stop.dragging .chiayi-pikmin-card {
  opacity: 0.68;
  transform: scale(0.985);
}

.chiayi-pikmin-stop.drag-over .chiayi-pikmin-card {
  outline: 2px dashed rgba(10, 111, 105, 0.62);
  outline-offset: 3px;
}

.chiayi-pikmin-card {
  background: var(--cp-card);
  border: 1px solid rgba(204, 232, 222, 0.95);
  border-radius: 18px;
  box-shadow: 0 6px 16px rgba(55, 113, 111, 0.07);
  overflow: hidden;
}

.chiayi-pikmin-card-main {
  padding: 11px 12px 10px;
}

.chiayi-pikmin-meta {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
  margin-bottom: 6px;
}

.chiayi-pikmin-time {
  color: var(--cp-leaf-dark);
  font-weight: 900;
  font-size: 13px;
}

.chiayi-pikmin-tag {
  font-size: 11px;
  padding: 3px 7px;
  border-radius: 999px;
  background: #f4edc9;
  color: var(--cp-muted);
  font-weight: 700;
}

.chiayi-pikmin-tag.current-tag,
.chiayi-pikmin-tag.stay,
.chiayi-pikmin-tag.zone {
  background: var(--cp-leaf-soft);
  color: var(--cp-leaf-dark);
  font-weight: 900;
}

.chiayi-pikmin-tag.zone {
  background: rgba(255, 243, 189, 0.8);
  color: #80671d;
}

.chiayi-pikmin-title-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.chiayi-pikmin-drag-handle {
  width: 28px;
  height: 32px;
  flex: 0 0 28px;
  display: inline-grid;
  place-content: center;
  gap: 3px;
  border: 1px solid rgba(204, 232, 222, 0.95);
  border-radius: 12px;
  background: rgba(235, 251, 248, 0.9);
  cursor: grab;
  touch-action: none;
}

.chiayi-pikmin-drag-handle:active {
  cursor: grabbing;
}

.chiayi-pikmin-drag-handle:disabled {
  opacity: 0.34;
  cursor: not-allowed;
}

.chiayi-pikmin-drag-handle span {
  width: 12px;
  height: 2px;
  border-radius: 99px;
  background: var(--cp-leaf-dark);
}

.chiayi-pikmin-stop-title {
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 7px;
}

.chiayi-pikmin-stop-title img {
  width: 26px;
  height: 26px;
  flex: 0 0 26px;
  object-fit: contain;
  filter: drop-shadow(0 2px 2px rgba(47, 64, 63, 0.12));
}

.chiayi-pikmin-title-row h2 {
  margin: 0;
  font-size: 16px;
  line-height: 1.35;
  min-width: 0;
}

.chiayi-pikmin-check {
  width: 32px;
  height: 32px;
  flex: 0 0 32px;
  border-radius: 14px;
  border: 1px solid var(--cp-line);
  background: #fff;
  color: var(--cp-leaf-dark);
  font-weight: 900;
  cursor: pointer;
}

.chiayi-pikmin-stop.done .chiayi-pikmin-check {
  background: var(--cp-leaf);
  color: white;
  border-color: var(--cp-leaf);
}

.chiayi-pikmin-desc {
  margin: 7px 0 0;
  color: var(--cp-muted);
  font-size: 13px;
  line-height: 1.45;
}

.chiayi-pikmin-reward {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  margin-top: 9px;
  padding: 6px 9px;
  border-radius: 999px;
  background: var(--cp-sun-soft);
  color: #6e5b15;
  font-size: 12px;
  font-weight: 900;
}

.chiayi-pikmin-card details {
  border-top: 1px solid #eee6c6;
  padding: 0 12px 12px;
}

.chiayi-pikmin-card summary {
  list-style: none;
  cursor: pointer;
  color: var(--cp-leaf-dark);
  font-weight: 900;
  font-size: 13px;
  padding: 9px 0;
}

.chiayi-pikmin-card summary::-webkit-details-marker {
  display: none;
}

.chiayi-pikmin-detail-grid {
  display: grid;
  gap: 8px;
  font-size: 13px;
  line-height: 1.48;
  color: var(--cp-muted);
}

.chiayi-pikmin-detail-grid b {
  color: var(--cp-text);
  display: block;
  margin-bottom: 2px;
}

.chiayi-pikmin-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 8px;
}

.chiayi-pikmin-chip {
  text-decoration: none;
  color: var(--cp-leaf-dark);
  background: var(--cp-leaf-soft);
  padding: 7px 10px;
  border-radius: 999px;
  font-size: 13px;
  font-weight: 900;
}

.chiayi-pikmin-actions {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
  padding: 2px 0 0;
}

.chiayi-pikmin-front-actions {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
  margin-top: 9px;
}

.chiayi-pikmin-reorder {
  display: grid;
  grid-template-columns: 1fr auto auto;
  gap: 8px;
  align-items: center;
  padding: 8px;
  border-radius: 14px;
  background: rgba(255, 243, 189, 0.46);
}

.chiayi-pikmin-reorder span {
  min-width: 0;
  color: var(--cp-muted);
  font-size: 12px;
  font-weight: 800;
}

.chiayi-pikmin-reorder button {
  border: 1px solid rgba(204, 232, 222, 0.95);
  border-radius: 12px;
  background: #fff;
  color: var(--cp-leaf-dark);
  padding: 8px 9px;
  font-size: 12px;
  font-weight: 900;
  cursor: pointer;
}

.chiayi-pikmin-reorder button:disabled {
  opacity: 0.38;
  cursor: not-allowed;
}

.chiayi-pikmin-action {
  display: inline-flex;
  justify-content: center;
  align-items: center;
  gap: 5px;
  text-decoration: none;
  border-radius: 14px;
  padding: 10px 8px;
  font-size: 13px;
  font-weight: 900;
  border: 1px solid var(--cp-line);
  color: var(--cp-text);
  background: #fff;
  cursor: pointer;
}

.chiayi-pikmin-action img {
  width: 20px;
  height: 20px;
  object-fit: contain;
  margin: -4px 0;
}

.chiayi-pikmin-action.primary {
  background: var(--cp-leaf-dark);
  color: white;
  border-color: var(--cp-leaf-dark);
}

.chiayi-pikmin-note-card {
  background: rgba(255, 254, 246, 0.76);
  border: 1px solid rgba(204, 232, 222, 0.95);
  border-radius: var(--cp-radius);
  padding: 16px;
  color: var(--cp-muted);
  font-size: 14px;
  line-height: 1.65;
  box-shadow: 0 8px 18px rgba(55, 113, 111, 0.07);
}

.chiayi-pikmin-note-card p {
  margin: 0 0 0.85rem;
}

.chiayi-pikmin-note-card p:last-child {
  margin-bottom: 0;
}

.chiayi-pikmin-note-card b {
  color: var(--cp-text);
}

.chiayi-pikmin-bottom-nav {
  position: fixed;
  left: 50%;
  bottom: 14px;
  transform: translateX(-50%);
  width: min(398px, calc(100% - 28px));
  background: rgba(47, 64, 63, 0.88);
  backdrop-filter: blur(14px);
  border-radius: 24px;
  padding: 10px;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
  box-shadow: 0 16px 40px rgba(47, 64, 63, 0.22);
  z-index: 30;
}

.chiayi-pikmin-bottom-nav button,
.chiayi-pikmin-bottom-nav a {
  border: 0;
  border-radius: 16px;
  padding: 12px 10px;
  font-weight: 900;
  text-align: center;
  text-decoration: none;
  cursor: pointer;
}

.chiayi-pikmin-bottom-nav .light {
  background: rgba(255,255,255,0.94);
  color: var(--cp-text);
}

.chiayi-pikmin-bottom-nav .dark {
  background: var(--cp-sun);
  color: #4f4411;
}

.chiayi-pikmin-page::before {
  content: "";
  position: fixed;
  inset: 0;
  pointer-events: none;
  background:
    repeating-linear-gradient(0deg, rgba(47, 64, 63, 0.045) 0 1px, transparent 1px 6px),
    repeating-radial-gradient(circle at 50% 22%, rgba(42, 122, 120, 0.16) 0 2px, transparent 2px 18px),
    linear-gradient(180deg, rgba(255, 243, 189, 0.32), rgba(228, 251, 248, 0.4));
  mix-blend-mode: multiply;
}

.chiayi-pikmin-page {
  background:
    linear-gradient(90deg, rgba(42, 122, 120, 0.08) 1px, transparent 1px),
    linear-gradient(0deg, rgba(42, 122, 120, 0.08) 1px, transparent 1px),
    linear-gradient(180deg, #fffdf1 0%, var(--cp-bg) 48%, #e7fbf8 100%);
  background-size: 22px 22px, 22px 22px, auto;
}

.chiayi-pikmin-hero {
  background: linear-gradient(180deg, rgba(255,253,241,0.98), rgba(255,249,223,0.84));
}

.chiayi-pikmin-hero-card,
.chiayi-pikmin-card,
.chiayi-pikmin-note-card,
.chiayi-pikmin-dessert-panel,
.chiayi-pikmin-dessert-card {
  border-radius: 8px;
}

.chiayi-pikmin-hero-card {
  padding: 10px;
  border: 1px solid rgba(42, 122, 120, 0.42);
  background:
    linear-gradient(90deg, rgba(127, 208, 202, 0.16), transparent 42%, rgba(255, 212, 90, 0.2)),
    rgba(255, 254, 247, 0.94);
  box-shadow:
    inset 0 0 0 1px rgba(255, 255, 255, 0.72),
    0 14px 34px rgba(55, 113, 111, 0.16);
}

.chiayi-pikmin-hero-card::after {
  right: -8px;
  top: -8px;
  width: 104px;
  height: 104px;
  border-radius: 50%;
  background:
    repeating-radial-gradient(circle, rgba(42, 122, 120, 0.34) 0 3px, rgba(255, 212, 90, 0.2) 3px 7px, transparent 7px 13px);
  opacity: 0.58;
}

.chiayi-pikmin-kicker,
.chiayi-pikmin-section-title {
  text-transform: uppercase;
  letter-spacing: 0.12em;
}

.chiayi-pikmin-dashboard-top strong::before {
  content: "";
  color: var(--cp-muted);
  font-size: 10px;
  font-weight: 900;
}

.chiayi-pikmin-progress-pill,
.chiayi-pikmin-drift,
.chiayi-pikmin-tag,
.chiayi-pikmin-reward,
.chiayi-pikmin-chip {
  border-radius: 6px;
}

.chiayi-pikmin-mini-btn,
.chiayi-pikmin-action.primary {
  background:
    linear-gradient(180deg, rgba(127, 208, 202, 0.22), transparent),
    var(--cp-leaf-dark);
  box-shadow: inset 0 -2px 0 rgba(0, 0, 0, 0.16);
}

.chiayi-pikmin-bar {
  height: 12px;
  border: 1px solid rgba(42, 122, 120, 0.24);
  background:
    repeating-linear-gradient(90deg, #eee4b7 0 10px, #fff3bd 10px 20px);
}

.chiayi-pikmin-bar > span {
  background:
    repeating-linear-gradient(90deg, var(--cp-leaf) 0 12px, var(--cp-sun) 12px 18px, var(--cp-blue) 18px 24px);
}

.chiayi-pikmin-card {
  border-color: rgba(42, 122, 120, 0.28);
  background:
    linear-gradient(90deg, rgba(127, 208, 202, 0.08), transparent 36%),
    rgba(255, 254, 247, 0.92);
}

.chiayi-pikmin-stop.current .chiayi-pikmin-card {
  outline: 2px solid rgba(240, 109, 94, 0.38);
  box-shadow: 0 0 0 4px rgba(255, 212, 90, 0.24), 0 8px 22px rgba(55, 113, 111, 0.12);
}

.chiayi-pikmin-stop::before {
  border-radius: 2px;
  transform: rotate(45deg);
}

.chiayi-pikmin-check,
.chiayi-pikmin-drag-handle,
.chiayi-pikmin-reorder,
.chiayi-pikmin-reorder button,
.chiayi-pikmin-action,
.chiayi-pikmin-time-tool label,
.chiayi-pikmin-now-box {
  border-radius: 6px;
}

.chiayi-pikmin-dessert-panel {
  padding: 12px;
  border: 1px solid rgba(42, 122, 120, 0.36);
  background:
    repeating-linear-gradient(135deg, rgba(127, 208, 202, 0.12) 0 8px, rgba(255, 243, 189, 0.18) 8px 16px),
    rgba(255, 254, 247, 0.88);
  box-shadow: 0 8px 18px rgba(55, 113, 111, 0.08);
}

.chiayi-pikmin-dessert-panel-summary {
  list-style: none;
  cursor: pointer;
  display: block;
}

.chiayi-pikmin-dessert-panel-summary::-webkit-details-marker {
  display: none;
}

.chiayi-pikmin-dessert-panel-summary span {
  display: grid;
  gap: 2px;
  padding: 3px 2px;
}

.chiayi-pikmin-dessert-panel-summary b {
  color: var(--cp-text);
  font-size: 15px;
  line-height: 1.35;
}

.chiayi-pikmin-dessert-panel-summary small {
  color: var(--cp-muted);
  font-size: 12px;
  font-weight: 900;
}

.chiayi-pikmin-dessert-content {
  display: grid;
  gap: 10px;
  margin-top: 10px;
}

.chiayi-pikmin-rain-brief {
  display: grid;
  gap: 7px;
  margin-bottom: 10px;
  padding: 10px;
  border: 1px solid rgba(42, 122, 120, 0.24);
  border-radius: 6px;
  background: rgba(228, 251, 248, 0.72);
}

.chiayi-pikmin-rain-brief span {
  color: var(--cp-leaf-dark);
  font-size: 11px;
  font-weight: 950;
  letter-spacing: 0.14em;
}

.chiayi-pikmin-rain-brief b {
  font-size: 13px;
  line-height: 1.5;
}

.chiayi-pikmin-dessert-list {
  display: grid;
  gap: 8px;
}

.chiayi-pikmin-batch-map {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 42px;
  border-radius: 6px;
  background:
    linear-gradient(180deg, rgba(127, 208, 202, 0.18), transparent),
    var(--cp-leaf-dark);
  color: #fff;
  text-decoration: none;
  font-size: 14px;
  font-weight: 950;
  box-shadow: inset 0 -2px 0 rgba(0,0,0,0.14);
}

.chiayi-pikmin-potion-list {
  display: grid;
  gap: 8px;
}

.chiayi-pikmin-potion-card {
  display: grid;
  grid-template-columns: 30px minmax(0, 1fr);
  gap: 9px;
  align-items: center;
  padding: 10px;
  border: 1px solid rgba(42, 122, 120, 0.26);
  border-radius: 6px;
  background: rgba(255, 254, 247, 0.94);
  color: inherit;
  text-decoration: none;
}

.chiayi-pikmin-potion-card b,
.chiayi-pikmin-potion-card small {
  display: block;
  min-width: 0;
}

.chiayi-pikmin-potion-card b {
  color: var(--cp-text);
  font-size: 14px;
  line-height: 1.35;
}

.chiayi-pikmin-potion-card small {
  margin-top: 2px;
  color: var(--cp-muted);
  font-size: 12px;
  font-weight: 800;
  line-height: 1.4;
}

.chiayi-pikmin-dessert-card {
  overflow: hidden;
  border: 1px solid rgba(42, 122, 120, 0.26);
  background: rgba(255, 254, 247, 0.94);
}

.chiayi-pikmin-dessert-card summary {
  list-style: none;
  display: grid;
  grid-template-columns: 30px minmax(0, 1fr);
  gap: 9px;
  align-items: center;
  padding: 10px;
  cursor: pointer;
}

.chiayi-pikmin-dessert-card summary::-webkit-details-marker {
  display: none;
}

.chiayi-pikmin-map-pin {
  width: 30px;
  height: 30px;
  display: grid;
  place-items: center;
  border-radius: 50% 50% 50% 4px;
  background: var(--cp-red);
  color: #fff;
  font-size: 13px;
  font-weight: 950;
  box-shadow: inset 0 -4px 0 rgba(0,0,0,0.12);
}

.chiayi-pikmin-map-pin {
  line-height: 1;
}

.chiayi-pikmin-dessert-card summary b,
.chiayi-pikmin-dessert-card summary small {
  display: block;
  min-width: 0;
}

.chiayi-pikmin-dessert-card summary b {
  color: var(--cp-text);
  font-size: 15px;
  line-height: 1.35;
}

.chiayi-pikmin-dessert-card summary small {
  margin-top: 2px;
  color: var(--cp-muted);
  font-size: 12px;
  font-weight: 800;
  line-height: 1.4;
}

.chiayi-pikmin-dessert-body {
  display: grid;
  gap: 8px;
  padding: 0 10px 10px;
  color: var(--cp-muted);
  font-size: 13px;
  line-height: 1.52;
}

.chiayi-pikmin-dessert-body p {
  margin: 0;
}

.chiayi-pikmin-dessert-body b {
  display: block;
  color: var(--cp-text);
}

.chiayi-pikmin-map-frame {
  overflow: hidden;
  height: 0;
  border: 1px solid rgba(42, 122, 120, 0.22);
  border-radius: 6px;
  background: var(--cp-leaf-soft);
  transition: height 0.24s ease;
}

.chiayi-pikmin-dessert-card[open] .chiayi-pikmin-map-frame {
  height: 210px;
}

.chiayi-pikmin-map-surface {
  position: relative;
  width: 100%;
  height: 100%;
  overflow: hidden;
  background:
    linear-gradient(90deg, rgba(42, 122, 120, 0.1) 1px, transparent 1px),
    linear-gradient(0deg, rgba(42, 122, 120, 0.1) 1px, transparent 1px),
    linear-gradient(135deg, rgba(255, 243, 189, 0.72), rgba(228, 251, 248, 0.84));
  background-size: 18px 18px, 18px 18px, auto;
}

.chiayi-pikmin-map-road {
  position: absolute;
  display: block;
  background: rgba(255, 254, 247, 0.78);
  border: 1px solid rgba(42, 122, 120, 0.12);
}

.chiayi-pikmin-map-road.horizontal {
  left: -10%;
  right: -10%;
  top: 58%;
  height: 18px;
  transform: rotate(-5deg);
}

.chiayi-pikmin-map-road.vertical {
  top: -10%;
  bottom: -10%;
  left: 48%;
  width: 16px;
  transform: rotate(7deg);
}

.chiayi-pikmin-map-road.diagonal {
  left: 15%;
  right: 8%;
  top: 35%;
  height: 14px;
  transform: rotate(28deg);
}

.chiayi-pikmin-map-zone {
  position: absolute;
  padding: 4px 6px;
  border-radius: 4px;
  background: rgba(255, 254, 247, 0.86);
  color: var(--cp-muted);
  font-size: 11px;
  font-weight: 900;
}

.chiayi-pikmin-map-zone.station {
  left: 8px;
  bottom: 10px;
}

.chiayi-pikmin-map-zone.culture {
  right: 8px;
  top: 10px;
}

.chiayi-pikmin-map-target {
  position: absolute;
  width: 34px;
  height: 34px;
  display: grid;
  place-items: center;
  transform: translate(-50%, -100%);
  border-radius: 50% 50% 50% 4px;
  background: var(--cp-red);
  color: #fff;
  font-size: 14px;
  font-weight: 950;
  box-shadow: 0 8px 16px rgba(47, 64, 63, 0.22), inset 0 -4px 0 rgba(0,0,0,0.13);
}

.chiayi-pikmin-map-target::after {
  content: "";
  position: absolute;
  left: 50%;
  bottom: -12px;
  width: 48px;
  height: 16px;
  transform: translateX(-50%);
  border-radius: 50%;
  border: 2px solid rgba(240, 109, 94, 0.36);
  background: rgba(255, 212, 90, 0.18);
}

.chiayi-pikmin-bottom-nav {
  border-radius: 8px;
  border: 1px solid rgba(255, 243, 189, 0.24);
}

.chiayi-pikmin-bottom-nav button,
.chiayi-pikmin-bottom-nav a {
  border-radius: 6px;
}

.chiayi-pikmin-control-title {
  position: relative;
  z-index: 1;
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 2px 10px;
  align-items: end;
  margin-bottom: 6px;
  padding: 7px 8px;
  border: 1px solid rgba(42, 122, 120, 0.26);
  border-radius: 6px;
  background:
    linear-gradient(90deg, rgba(47, 64, 63, 0.84), rgba(42, 122, 120, 0.72)),
    var(--cp-leaf-dark);
  color: #fffef7;
  overflow: hidden;
}

.chiayi-pikmin-control-title::before {
  content: "";
  position: absolute;
  right: -10px;
  top: -28px;
  width: 92px;
  height: 92px;
  border-radius: 50%;
  background:
    repeating-radial-gradient(circle, rgba(255, 212, 90, 0.82) 0 4px, rgba(255, 212, 90, 0.08) 4px 10px, transparent 10px 16px);
  opacity: 0.7;
  animation: chiayi-pikmin-hypno-spin 10s linear infinite;
}

.chiayi-pikmin-control-title span,
.chiayi-pikmin-control-title h1,
.chiayi-pikmin-control-title p {
  position: relative;
  z-index: 1;
}

.chiayi-pikmin-control-title span {
  grid-column: 1 / -1;
  color: var(--cp-sun);
  font-size: 11px;
  font-weight: 950;
  letter-spacing: 0.16em;
}

.chiayi-pikmin-control-title h1 {
  margin: 0;
  font-size: 20px;
  line-height: 1.18;
  letter-spacing: 0;
}

.chiayi-pikmin-control-title p {
  margin: 0;
  color: rgba(255, 254, 247, 0.84);
  font-size: 12px;
  font-weight: 800;
  white-space: nowrap;
}

.chiayi-pikmin-control-stats {
  position: relative;
  z-index: 1;
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 5px;
  margin-top: 7px;
}

.chiayi-pikmin-control-stats span {
  min-width: 0;
  padding: 7px 5px;
  border: 1px solid rgba(42, 122, 120, 0.18);
  border-radius: 6px;
  background: rgba(255, 254, 247, 0.78);
  color: var(--cp-muted);
  font-size: 10px;
  line-height: 1.25;
  font-weight: 900;
  text-align: center;
}

.chiayi-pikmin-control-stats b {
  display: block;
  color: var(--cp-leaf-dark);
  font-size: 13px;
  line-height: 1.2;
  overflow-wrap: anywhere;
}

.chiayi-pikmin-node-code {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 8px;
  align-items: center;
  margin-bottom: 7px;
  padding: 6px 8px;
  border-radius: 6px;
  background:
    linear-gradient(90deg, rgba(255, 212, 90, 0.24), rgba(228, 251, 248, 0.64));
  color: var(--cp-leaf-dark);
  font-size: 12px;
  font-weight: 950;
}

.chiayi-pikmin-node-code span,
.chiayi-pikmin-node-code em {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.chiayi-pikmin-node-code em {
  color: #8f4d43;
  font-size: 11px;
  font-style: normal;
  letter-spacing: 0.04em;
}

.chiayi-pikmin-control-readout {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 6px;
  margin-top: 9px;
}

.chiayi-pikmin-control-readout span {
  min-width: 0;
  padding: 6px 6px;
  border: 1px solid rgba(42, 122, 120, 0.18);
  border-radius: 6px;
  background: rgba(228, 251, 248, 0.52);
  color: var(--cp-text);
  font-size: 12px;
  font-weight: 950;
  text-align: center;
}

.chiayi-pikmin-control-readout b {
  display: block;
  color: var(--cp-muted);
  font-size: 10px;
  line-height: 1.25;
}

.chiayi-pikmin-check {
  width: 44px;
  height: 34px;
  flex-basis: 44px;
  border-radius: 6px;
  font-size: 11px;
}

.chiayi-pikmin-stop.current .chiayi-pikmin-node-code {
  background:
    repeating-linear-gradient(90deg, rgba(255, 212, 90, 0.48) 0 12px, rgba(127, 208, 202, 0.24) 12px 24px);
}

.chiayi-pikmin-action.primary {
  border: 1px solid var(--cp-leaf-dark);
}

button.chiayi-pikmin-action {
  font-family: inherit;
}

.chiayi-pikmin-modal-backdrop {
  position: fixed;
  inset: 0;
  z-index: 300;
  display: grid;
  place-items: center;
  padding: 18px;
  background:
    repeating-radial-gradient(circle at 50% 45%, rgba(255, 212, 90, 0.18) 0 8px, rgba(42, 122, 120, 0.12) 8px 18px, transparent 18px 30px),
    rgba(47, 64, 63, 0.62);
  backdrop-filter: blur(10px);
}

.chiayi-pikmin-command-modal {
  width: min(390px, 100%);
  padding: 16px;
  border: 1px solid rgba(255, 212, 90, 0.58);
  border-radius: 8px;
  background:
    linear-gradient(135deg, rgba(47, 64, 63, 0.96), rgba(42, 122, 120, 0.92)),
    var(--cp-leaf-dark);
  color: #fffef7;
  box-shadow: 0 24px 80px rgba(47, 64, 63, 0.45);
}

.chiayi-pikmin-modal-kicker {
  display: block;
  color: var(--cp-sun);
  font-size: 11px;
  font-weight: 950;
  letter-spacing: 0.14em;
}

.chiayi-pikmin-command-modal h2 {
  margin: 6px 0 8px;
  font-size: 22px;
  line-height: 1.25;
}

.chiayi-pikmin-command-modal p {
  margin: 0;
  color: rgba(255, 254, 247, 0.84);
  font-size: 14px;
  line-height: 1.58;
}

.chiayi-pikmin-command-modal p b {
  color: #fff;
}

.chiayi-pikmin-modal-readout {
  display: grid;
  gap: 6px;
  margin: 12px 0;
}

.chiayi-pikmin-modal-readout span {
  padding: 8px 9px;
  border: 1px solid rgba(255, 212, 90, 0.24);
  border-radius: 6px;
  background: rgba(255, 254, 247, 0.1);
  color: var(--cp-sun);
  font-size: 12px;
  font-weight: 950;
}

.chiayi-pikmin-modal-actions {
  display: grid;
  grid-template-columns: 0.78fr 1fr 1fr;
  gap: 8px;
}

.chiayi-pikmin-modal-actions button {
  min-width: 0;
  border: 0;
  border-radius: 6px;
  padding: 11px 8px;
  background: rgba(255, 254, 247, 0.92);
  color: var(--cp-text);
  font-family: inherit;
  font-size: 13px;
  font-weight: 950;
  cursor: pointer;
}

.chiayi-pikmin-modal-actions button:nth-child(2) {
  background: var(--cp-sun);
  color: #4f4411;
}

.chiayi-pikmin-modal-actions .deep {
  background: var(--cp-red);
  color: #fff;
}

@keyframes chiayi-pikmin-hypno-spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

@media (min-width: 720px) {
  .chiayi-pikmin-app {
    padding-top: 24px;
  }
}
`;
