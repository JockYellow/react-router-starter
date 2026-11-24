export type Role = "yanzhen" | "hanyu";
export const PEOPLE: Record<Role, string> = { yanzhen: "彥禎", hanyu: "涵郁" };
export const ROLES: Role[] = ["yanzhen", "hanyu"];

export const ROUTES: Record<string, { name: string; subtitle: string; desc: string; price: [number, number]; traits: Record<string, number>; flags?: string[] }> = {
 A: { name:"北埔 × 峨眉", subtitle:"從北埔的一碗茶，走到峨眉湖的午後", desc:"客庄美食、擂茶、湖畔與景觀", price:[600,1300], traits:{food:.24,scenery:.22,culture:.14,craft:.13,discover:.12,rest:.15}, flags:["機車較方便"] },
 C: { name:"內灣 × 尖石", subtitle:"一路往山裡走，最後把冬天交給熱湯", desc:"老街、山景、溫泉與休憩", price:[900,2100], traits:{rest:.36,scenery:.22,food:.11,discover:.13,nature:.10,culture:.08}, flags:["泡湯須預約","機車或接駁"] },
 D: { name:"新埔 × 關西", subtitle:"老房子與柿染，原來有這麼多故事", desc:"老建築、柿染、茶廠與客家飲食", price:[700,1600], traits:{craft:.32,culture:.28,discover:.17,food:.13,rest:.10}, flags:["體驗須預約"] },
 F: { name:"南寮 × 香山", subtitle:"追著海風走，看看能騎到哪裡", desc:"海岸單車、賞景、濕地", price:[500,1300], traits:{active:.34,scenery:.25,nature:.17,discover:.14,rest:.10}, flags:["冬季強風","騎車活動"] },
 G: { name:"湖口 × 新豐", subtitle:"走進小鎮，找那些沒人特別說的事", desc:"紅磚老街、特色店、紅樹林生態", price:[500,1200], traits:{discover:.31,culture:.21,nature:.23,scenery:.17,craft:.08}, flags:["跨點交通","部分手作需預約"] },
 H: { name:"竹東 × 橫山", subtitle:"從市場的人聲，走到山裡的安靜", desc:"在地市場、藝文空間、古道與景觀", price:[500,1200], traits:{nature:.25,active:.27,discover:.21,culture:.15,scenery:.12}, flags:["山路","步道依天候"] }
};
export const ROUTE_KEYS = Object.keys(ROUTES);

export type Question = {
 id: string; chapter: string; title: string; desc: string;
 kind: "rating" | "postcard" | "coins" | "reality" | "note";
 items?: [string,string][]; low?: string; high?: string; talk: string;
};

export const QUESTIONS: Question[] = [
 {id:"radar",chapter:"01 · 蒐集旅程碎片",title:"先問問自己，到底想去哪裡快樂？",desc:"要安排一整天，突然發現想做的事情好多喔！以下六種快樂，你各自有多期待？不用客氣，全部喜歡也行。",kind:"rating",low:"完全無感",high:"超級心動",items:[
 ["food","吃到一口讓人忍不住說「欸這好吃！」的東西"],["scenery","看到漂亮的景色，突然就想多待一下"],["culture","發現老街與老房子背後的生活故事"],["craft","兩個人一起動手做出一件有點特別的東西"],["discover","隨意走走，撞見原本沒排進去的小驚喜"],["active","走得有點累，卻覺得今天真的玩得很過癮"]],talk:"有哪個答案跟你想像中的對方不一樣？"},
 {id:"postcard",chapter:"01 · 蒐集旅程碎片",title:"如果這趟旅行只能留下兩張照片",desc:"有時候一個瞬間會在記憶裡停很久。假設只能留下兩種畫面，再割捨一種，你會怎麼選？我知道，這題有點殘忍。",kind:"postcard",items:[
 ["comfort","在舒服的地方坐著，光聊天就很好"],["created","一起動手，作品好不好看先放旁邊"],["view","看見很美的風景，當下只想再多待一會"],["surprise","誤打誤撞，發現有趣的小店或故事"],["challenge","一起完成有點辛苦、但很值得的小挑戰"]],talk:"你最捨不得刪掉哪個畫面？對方又把什麼留下了？"},
 {id:"coins",chapter:"02 · 拼出理想的一天",title:"一天就這麼長，八枚時間金幣怎麼花？",desc:"想吃、想逛、想看風景，還想休息。啊啊，時間只有八枚金幣！分給五種活動，全部用完，看看自己最捨得把時間交給什麼。",kind:"coins",items:[
 ["food","吃喝尋寶：有趣的小吃與店家"],["scenery","看風景：拍拍照，捨不得走就多待一下"],["craft","動手玩：手作、體驗、沒做過的事"],["active","往外探險：騎車或去看看下一個地方"],["rest","好好耍廢：喝咖啡、休息、聊天"]],talk:"你們把金幣花在同一個地方嗎？還是意外很不一樣？"},
 {id:"mystery",chapter:"02 · 拼出理想的一天",title:"地圖的背面，竟然還有四張紙條",desc:"有些地方光看介紹根本不知道好不好玩。但就是因為不知道，才會想去找找看吧？四條線索，你想追到哪裡？",kind:"rating",low:"先不要",high:"立刻出發",items:[
 ["old","巷子裡的老店，保存了特殊的傳統做法"],["ecology","海邊小徑裡藏著許多小小生命"],["forest","穿過一段林間小路，會有不同風景"],["artisan","有位職人願意教你陌生手藝"]],talk:"如果對方很想去查一條線索，你願意跟著一起冒險嗎？"},
 {id:"trade",chapter:"03 · 地圖上的意外岔路",title:"這趟旅行，有些東西得用時間換",desc:"排隊、走路、提前預約、坐很久的車……好東西偶爾就是有點麻煩。看看下面這幾筆交易，你願意付出多少？",kind:"rating",low:"完全不值得",high:"很值得",items:[
 ["queue","為了期待的料理，多等半小時"],["walk","為了好風景，走一段有上下坡的路"],["book","為了難得的體驗，配合預約時段"],["distance","為了特別的目的地，多花一小時交通"]],talk:"有哪一件事情，你自己不一定願意，但陪對方就可以？"},
 {id:"fork",chapter:"03 · 地圖上的意外岔路",title:"糟了，原本的地圖被風吹亂了",desc:"目的地沒開、小店太好逛、天氣突然變了。旅程總有些不按牌理出牌的時候，你通常會怎麼辦？",kind:"rating",low:"完全不像",high:"根本就是我",items:[
 ["spontaneous","原定目的地沒開，就探索附近陌生區域"],["linger","路過的小店很有趣，多留一小時也好"],["slow","現在待得舒服，少跑幾個點也值得"],["outline","即使臨時變動，也想知道大致的安排"]],talk:"如果真的迷路或臨時改行程，我們兩個會先做什麼？"},
 {id:"duo",chapter:"04 · 把兩張地圖放在一起",title:"兩個人一起走，會變成什麼樣子？",desc:"同一段路，有人想一直聊天，有人光是安靜看風景就很滿足。這題不算分，我只是想知道，你喜歡怎麼跟一個人一起旅行。",kind:"rating",low:"不太像我",high:"非常符合",items:[
 ["talk","一路分享看到的東西，想到什麼就聊"],["make","一起嘗試新東西，就算做得笨拙也很好"],["quiet","即使沒在說話，待在一起也很舒服"],["support","對方特別期待時，願意走進他的興趣世界"]],talk:"哪一種相處方式，是你很希望對方能理解的？"},
 {id:"reality",chapter:"04 · 把兩張地圖放在一起",title:"出發前，稍微把現實拿出來看看",desc:"再喜歡的地方，也總得考慮一下花費、天氣跟體力啦。這裡先算 D2 每個人的當地交通、吃喝和體驗，不含住宿及往返新竹的車費。",kind:"reality",talk:"如果真的要少花一筆，你最不想犧牲的是什麼？"},
 {id:"routes",chapter:"05 · 六扇目的地之門",title:"六條路攤開了，哪一條在叫你？",desc:"都走到這裡了，終於可以看看真正的目的地！六條路各給一到五分，可以全部喜歡，也不用硬選第一名。",kind:"rating",low:"興趣很低",high:"非常期待",items:ROUTE_KEYS.map(id=>[id, id+"｜"+ROUTES[id].name+" — "+ROUTES[id].desc]),talk:"哪一條本來不在你的想像裡，卻突然有點想去了？"},
 {id:"note",chapter:"終幕 · 留給對方",title:"最後一張紙條，留給你",desc:"如果能偷偷替對方準備一件小事，你會想做什麼？或者，你只是有一句想說的話。寫在這裡，等兩張地圖重疊時再一起打開。",kind:"note",talk:"有沒有一件小小的願望，我們真的可以帶進這趟旅行？"}
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
