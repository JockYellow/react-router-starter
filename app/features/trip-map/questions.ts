export type Role = "yanzhen" | "hanyu";
export const PEOPLE: Record<Role, string> = { yanzhen: "彥禎", hanyu: "涵郁" };
export const ROLES: Role[] = ["yanzhen", "hanyu"];

export const ROUTES: Record<string, { name: string; subtitle: string; desc: string; price: [number, number]; traits: Record<string, number>; flags?: string[] }> = {
 A: { name:"北埔 × 峨眉", subtitle:"有滋有味的慢生活", desc:"客庄美食、擂茶、湖畔與景觀", price:[600,1300], traits:{food:.24,scenery:.22,culture:.14,craft:.13,discover:.12,rest:.15}, flags:["機車較方便"] },
 C: { name:"內灣 × 尖石", subtitle:"山城裡的冬日假期", desc:"老街、山景、溫泉與休憩", price:[900,2100], traits:{rest:.36,scenery:.22,food:.11,discover:.13,nature:.10,culture:.08}, flags:["泡湯須預約","機車或接駁"] },
 D: { name:"新埔 × 關西", subtitle:"一起解鎖地方工藝", desc:"老建築、柿染、茶廠與客家飲食", price:[700,1600], traits:{craft:.32,culture:.28,discover:.17,food:.13,rest:.10}, flags:["體驗須預約"] },
 F: { name:"南寮 × 香山", subtitle:"迎著海風的自由一天", desc:"海岸單車、賞景、濕地", price:[500,1300], traits:{active:.34,scenery:.25,nature:.17,discover:.14,rest:.10}, flags:["冬季強風","騎車活動"] },
 G: { name:"湖口 × 新豐", subtitle:"被忽略的小地方尋寶", desc:"紅磚老街、特色店、紅樹林生態", price:[500,1200], traits:{discover:.31,culture:.21,nature:.23,scenery:.17,craft:.08}, flags:["跨點交通","部分手作需預約"] },
 H: { name:"竹東 × 橫山", subtitle:"走進山林的探險", desc:"在地市場、藝文空間、古道與景觀", price:[500,1200], traits:{nature:.25,active:.27,discover:.21,culture:.15,scenery:.12}, flags:["山路","步道依天候"] }
};
export const ROUTE_KEYS = Object.keys(ROUTES);

export type Question = {
 id: string; chapter: string; title: string; desc: string;
 kind: "rating" | "postcard" | "coins" | "reality" | "note";
 items?: [string,string][]; low?: string; high?: string; talk: string;
};

export const QUESTIONS: Question[] = [
 {id:"radar",chapter:"01 · 蒐集旅程碎片",title:"快樂散落在地圖各處",desc:"你撿到六種旅行碎片。每一種對你有多大的吸引力？可以全部都喜歡。",kind:"rating",low:"完全無感",high:"超級心動",items:[
 ["food","意外吃到令人眼睛一亮的在地美食"],["scenery","站在漂亮風景前，捨不得移開視線"],["culture","聽見一段老地方的有趣故事"],["craft","親手做出一件獨一無二的小作品"],["discover","在陌生角落發現地圖沒標註的驚喜"],["active","玩得有點累，卻有痛快的滿足感"]],talk:"哪種快樂，你原本以為對方會最喜歡？"},
 {id:"postcard",chapter:"01 · 蒐集旅程碎片",title:"只有三張底片的相機",desc:"這台相機只能留下兩種美好回憶，還要標出一種沒拍到也不遺憾的畫面。",kind:"postcard",items:[
 ["comfort","舒服的地方，兩人慢慢享受時間"],["created","一起完成作品，過程中還發生笑話"],["view","眼前景色太美，想再多停一會"],["surprise","在小地方遇見意想不到的故事"],["challenge","一起跨過小挑戰，得到成就感"]],talk:"如果只能拍下兩張照片，會不會願意讓給對方一張？"},
 {id:"coins",chapter:"02 · 拼出理想的一天",title:"旅行時間只剩八枚金幣",desc:"把八枚時間金幣分到五個口袋；你可以集中投資某幾件事，但必須分完。",kind:"coins",items:[
 ["food","吃喝尋寶：地方美食與小店"],["scenery","風景收藏：拍照與風景停留"],["craft","驚喜體驗：手作與新事物"],["active","移動探險：騎車與探索不同地方"],["rest","自在充電：咖啡、休息與聊天"]],talk:"你們把最多時間放在同一件事情上嗎？"},
 {id:"mystery",chapter:"02 · 拼出理想的一天",title:"地圖背面的四張神秘紙條",desc:"當地人留下四個線索，還不知道好不好玩。光看提示，你想追查到什麼程度？",kind:"rating",low:"先不要",high:"立刻出發",items:[
 ["old","巷子裡的老店，保存了特殊的傳統做法"],["ecology","海邊小徑裡藏著許多小小生命"],["forest","穿過一段林間小路，會有不同風景"],["artisan","有位職人願意教你陌生手藝"]],talk:"對方很想追查的線索裡，有沒有你也願意一起去的？"},
 {id:"trade",chapter:"03 · 地圖上的意外岔路",title:"旅途交換所：值得嗎？",desc:"每份美好體驗都需要付出一點代價。這些交易條件你有多願意成交？",kind:"rating",low:"完全不值得",high:"很值得",items:[
 ["queue","為了期待的料理，多等半小時"],["walk","為了好風景，走一段有上下坡的路"],["book","為了難得的體驗，配合預約時段"],["distance","為了特別的目的地，多花一小時交通"]],talk:"有沒有一件事，因為對方很期待，你會更願意付出努力？"},
 {id:"fork",chapter:"03 · 地圖上的意外岔路",title:"原本的地圖，被風吹亂了",desc:"旅行開始發生一點變化，以下反應有多像平常的你？",kind:"rating",low:"完全不像",high:"根本就是我",items:[
 ["spontaneous","原定目的地沒開，就探索附近陌生區域"],["linger","路過的小店很有趣，多留一小時也好"],["slow","現在待得舒服，少跑幾個點也值得"],["outline","即使臨時變動，也想知道大致的安排"]],talk:"旅程突然改變時，你們會怎麼一起決定下一步？"},
 {id:"duo",chapter:"04 · 把兩張地圖放在一起",title:"理想的雙人旅行小隊",desc:"這題留給認識彼此，不直接影響路線分數。",kind:"rating",low:"不太像我",high:"非常符合",items:[
 ["talk","一路分享看到的東西，想到什麼就聊"],["make","一起學習、製作或完成一件特別的事"],["quiet","不必一直說話，也能舒服欣賞眼前一切"],["support","對方特別期待時，願意走進他的興趣世界"]],talk:"哪種相處方式，是你一直希望對方知道的？"},
 {id:"reality",chapter:"04 · 把兩張地圖放在一起",title:"出發前的現實口袋",desc:"認真一下：填的是每人 D2 一天的當地交通、餐飲與體驗費用；不含住宿及往返新竹長途交通。",kind:"reality",talk:"如果要減少一筆花費，你們最願意先省哪一項？"},
 {id:"routes",chapter:"05 · 六扇目的地之門",title:"六條路，就在眼前",desc:"每條獨立評 1 到 5 分；它們可以全部令人心動。",kind:"rating",low:"興趣很低",high:"非常期待",items:ROUTE_KEYS.map(id=>[id, id+"｜"+ROUTES[id].name+" — "+ROUTES[id].desc]),talk:"哪個地方光看簡介就想去？有沒有被低估的路線？"},
 {id:"note",chapter:"終幕 · 留給對方",title:"地圖上的秘密註記",desc:"如果能悄悄為對方安排一件讓他開心的小事，你會留下什麼話？最後才一起打開。",kind:"note",talk:"你們想把哪一件小事，真的放進這次旅行？"}
];

export function validAnswer(index: number, answer: unknown): boolean {
 const q=QUESTIONS[index]; if(!q || !answer || typeof answer!=="object" || Array.isArray(answer)) return false;
 const a=answer as Record<string,any>;
 if(q.kind==="rating") return !!q.items && q.items.every(([k])=>Number.isInteger(a[k])&&a[k]>=1&&a[k]<=5);
 if(q.kind==="coins") return !!q.items && q.items.every(([k])=>Number.isInteger(a[k])&&a[k]>=0&&a[k]<=8) && q.items.reduce((s,[k])=>s+a[k],0)===8;
 if(q.kind==="postcard"){const keys=(q.items||[]).map(x=>x[0]);return Array.isArray(a.keep)&&a.keep.length===2&&new Set(a.keep).size===2&&a.keep.every((k:string)=>keys.includes(k))&&keys.includes(a.drop)&&!a.keep.includes(a.drop);}
 if(q.kind==="reality") return Number.isInteger(a.preferred)&&a.preferred>=0&&a.preferred<=10000 && Number.isInteger(a.cap)&&a.cap>=a.preferred&&a.cap<=20000 && Number.isInteger(a.cold)&&a.cold>=1&&a.cold<=5 && Number.isInteger(a.effort)&&a.effort>=1&&a.effort<=5;
 if(q.kind==="note") return typeof a.message==="string"&&a.message.length<=400;
 return false;
}

export type Answers = Record<string,Record<string,any>>;
function clamp(n:number){return Math.max(1,Math.min(5,n));}
export function individualFit(ans:Answers) {
 const radar=ans.radar||{}, mystery=ans.mystery||{}, coins=ans.coins||{}, trade=ans.trade||{}, fork=ans.fork||{}, routeStars=ans.routes||{};
 const traits:Record<string,number>={
 food: Number(radar.food||3), scenery:Number(radar.scenery||3),
 culture:(Number(radar.culture||3)*.7 + Number(mystery.old||3)*.3),
 craft:(Number(radar.craft||3)*.65+Number(mystery.artisan||3)*.35),
 discover:(Number(radar.discover||3)*.6+Number(fork.spontaneous||3)*.4),
 active:Number(radar.active||3),
 rest:(Number(fork.slow||3)*.65+Number(coins.rest||0)*.35*1.6),
 nature:(Number(mystery.ecology||3)+Number(mystery.forest||3))/2
 };
 const tally=Object.values(coins).reduce((s,x)=>s+Number(x||0),0);
 if(tally===8){ for(const k of ["food","scenery","craft","active","rest"]) traits[k]=clamp(traits[k]*.8+clamp(1+Number(coins[k]||0))* .2); }
 const reality=ans.reality||{};
 return ROUTE_KEYS.map(id=>{
  const route=ROUTES[id]; const projected=Object.entries(route.traits).reduce((s,[k,w])=>s+clamp(traits[k]??3)*w,0);
  let fit=clamp((Number(routeStars[id]||3)*.58)+(projected*.42));
  const alerts:string[]=[];
  if(typeof reality.cap==="number" && Number.isFinite(reality.cap) && reality.cap<route.price[0]) alerts.push("估計低消超過預算上限");
  else if(Number(reality.preferred||0)>0 && reality.preferred<route.price[1]) alerts.push("部分玩法可能超出舒服預算");

  if(id==="F" && reality.cold<=2) alerts.push("對海風耐受度低");
  if(id==="H" && reality.effort<=2) alerts.push("需要輕量步道版本");
  if(id==="C" && Number(trade.book||3)<=2) alerts.push("泡湯須配合預約");
  if(id==="D" && Number(trade.book||3)<=2) alerts.push("手作導覽須配合預約");
  return {id,score:Number(fit.toFixed(2)),direct:Number(routeStars[id]||3),alerts};
 });
}
export function pairFit(both:Record<Role,Answers>){
 const a=individualFit(both.yanzhen),b=individualFit(both.hanyu);
 return ROUTE_KEYS.map((id,i)=>{
  const x=a[i],y=b[i];
  const common=Number((Math.min(x.score,y.score)*.6+(x.score+y.score)/2*.4).toFixed(2));
  return {id,score:common, people:{yanzhen:x,hanyu:y},alerts:Array.from(new Set([...x.alerts,...y.alerts]))};
 }).sort((x,y)=>y.score-x.score);
}
