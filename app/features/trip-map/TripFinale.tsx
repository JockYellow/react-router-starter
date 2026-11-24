import { useEffect, useRef, useState, type ReactNode } from "react";
import { ArrowRight, BookOpenText, ChevronRight, LockKeyhole, ScrollText, Sparkles } from "lucide-react";
import { ROUTES, type pairFit } from "./questions";
import { JourneyLedger } from "./JourneyLedger";
import { ScrollUnfurl } from "./ScrollUnfurl";

type Matches=ReturnType<typeof pairFit>;
type Scene=0|1|2|3|4|5|6;

/** 直選與偏好各是獨立事件；末頁並排呈現，絕不暗中加權混算。 */
export function TripFinale({matches,children}:{matches:Matches;children:ReactNode}){
 const [scene,setScene]=useState<Scene>(0);
 const [hasTurned,setHasTurned]=useState(false);
 const [unlocked,setUnlocked]=useState(0);
 const root=useRef<HTMLDivElement>(null);
 const direct=[...matches].sort((a,b)=>b.directScore-a.directScore||b.preferenceScore-a.preferenceScore);
 const inferred=[...matches].sort((a,b)=>b.preferenceScore-a.preferenceScore||b.directScore-a.directScore);
 const next=(value:Scene)=>{setHasTurned(true);setScene(value);root.current?.scrollIntoView({block:"start",behavior:"smooth"});};
 useEffect(()=>{
  if(scene!==1&&scene!==2){setUnlocked(0);return;}
  setUnlocked(0);
  const timers=[setTimeout(()=>setUnlocked(1),1100),setTimeout(()=>setUnlocked(2),1800),setTimeout(()=>setUnlocked(3),2500)];
  return ()=>timers.forEach(clearTimeout);
 },[scene]);
 const titles=["兩張地圖，重新攤開","第一封密函 · 直覺想去哪","第二封密函 · 答案透露的喜好","兩份結果 · 放在一起看","第三封密函 · 那張帳單","帳單揭曉 · 我們的秘密","六條岔路 · 最後一卷"];
 const rankings=(kind:"direct"|"preference")=>{
  const rows=(kind==="direct"?direct:inferred).slice(0,3);
  return <div className="tm-finale__rankings">{rows.map((m,i)=><div className={"tm-finale-rank "+(unlocked>=i+1?"is-revealed":"")} key={m.id} style={{transitionDelay:i*75+"ms"}}>
   <div className="tm-finale-rank__index"><span>{i+1}</span><small>{kind==="direct"?"心動排名":"偏好排名"}</small></div>
   <div className="tm-finale-rank__copy"><span>{ROUTES[m.id].subtitle}</span><h2>{m.id} · {ROUTES[m.id].name}</h2>
    <div className="tm-finale-rank__individual">彥禎 {kind==="direct"?m.people.yanzhen.direct.toFixed(1):m.people.yanzhen.preference.toFixed(1)}　·　涵郁 {kind==="direct"?m.people.hanyu.direct.toFixed(1):m.people.hanyu.preference.toFixed(1)}</div>
   </div>
   <div className="tm-finale-rank__score"><strong>{unlocked>=i+1?(kind==="direct"?m.directScore:m.preferenceScore).toFixed(1):"？"}</strong><small>/ 5</small></div>
  </div>)}</div>;
 };
 return <div className="tm-finale" ref={root}>
  {hasTurned&&<ScrollUnfurl key={"finale:"+scene} title={titles[scene]} subtitle={"旅の謎 · 第 "+(scene+1)+" 幕"}/>}
  <div className="tm-finale__progress" aria-label="結算揭曉進度">{titles.map((_,i)=><span key={i} className={scene>=i?"is-active":""}/>)}</div>
  {scene===0&&<section className="tm-finale-scene tm-finale-scene--intro">
   <div className="tm-finale-scene__crest" aria-hidden="true"><span>解</span></div>
   <p className="tm-finale__eyebrow">終ノ章 · 兩張地圖終於攤開</p>
   <h1>兩份答案，<br/>竟然能畫出兩張不同的地圖。</h1>
   <div className="tm-finale-scene__line" aria-hidden="true"><span/><span/><span/></div>
   <p>一張是我們直覺想去的地方，<br/>另一張，是一路回答下來，悄悄留下的偏好。<br/>先分開看，再一起攤開吧。</p>
   <button className="tm-finale__action" onClick={()=>next(1)}><ScrollText size={20}/>先看看我們最想去哪裡<ArrowRight size={18}/></button>
  </section>}
  {scene===1&&<section className="tm-finale-scene tm-finale-scene--scores">
   <p className="tm-finale__eyebrow">第一封密函 · 第九題直選</p>
   <h1>不用解釋，<br/>就是想去這裡。</h1>
   <p className="tm-finale__sub">這份排名只使用第 9 題六條路線的直接評分。每個人的第一印象很重要，所以先讓它獨立站在這裡。</p>
   {rankings("direct")}
   <p className="tm-finale__sub tm-finale__sub--small">共同分數較重視兩人中給分較低的一方；此處完全沒有混入其他題目。</p>
   <button className="tm-finale__action" disabled={unlocked<3} onClick={()=>next(2)}>那麼，前面那些答案又說了什麼？<ChevronRight size={18}/></button>
  </section>}
  {scene===2&&<section className="tm-finale-scene tm-finale-scene--scores">
   <p className="tm-finale__eyebrow">第二封密函 · 旅行偏好推算</p>
   <h1>有些喜歡，<br/>連自己都還沒發現。</h1>
   <p className="tm-finale__sub">這裡只根據第 1、3、4、6 題的興趣、時間金幣、神秘線索與旅途步調，對照六條路線的特色計算。第 9 題的直選分數完全不參與。</p>
   {rankings("preference")}
   <p className="tm-finale__sub tm-finale__sub--small">第 2 題與第 7 題保留作答交流；第 5、8 題用作預約、預算與戶外條件提醒，不列入數字排名。</p>
   <button className="tm-finale__action" disabled={unlocked<3} onClick={()=>next(3)}>把兩份結果攤在一起<ChevronRight size={18}/></button>
  </section>}
  {scene===3&&<section className="tm-finale-scene tm-finale-scene--comparison">
   <p className="tm-finale__eyebrow">兩張地圖 · 並排比較</p>
   <h1>我們想去的，<br/>和我們適合的。</h1>
   <p className="tm-finale__sub">兩套結果獨立排列，不產生一個混合總分。看看有沒有哪條路，在兩份地圖裡都排得很前面？</p>
   <div className="tm-finale-dual">
    <div><h2>直覺心動榜</h2><small>只看第 9 題</small>{direct.map((m,i)=><div className="tm-finale-dual__row" key={m.id}><span>{i+1}. {m.id} · {ROUTES[m.id].name}</span><b>{m.directScore.toFixed(1)}</b></div>)}</div>
    <div><h2>隱藏偏好榜</h2><small>第 1、3、4、6 題推算</small>{inferred.map((m,i)=><div className="tm-finale-dual__row" key={m.id}><span>{i+1}. {m.id} · {ROUTES[m.id].name}</span><b>{m.preferenceScore.toFixed(1)}</b></div>)}</div>
   </div>
   <p className="tm-finale__sub tm-finale__sub--small">數字都是兩人共同分數（滿分 5），沒有 58／42 權重。各人的評分與路線提醒在最後一頁仍可完整查看。</p>
   <button className="tm-finale__action" onClick={()=>next(4)}>等等，好像還有一封信<ChevronRight size={18}/></button>
  </section>}
  {scene===4&&<section className="tm-finale-scene tm-finale-scene--bill">
   <div className="tm-finale-bill__rays" aria-hidden="true"/>
   <div className="tm-finale-bill__envelope" aria-hidden="true"><span>秘</span></div>
   <p className="tm-finale__eyebrow">第三封密函 · 等等，帳單來了</p>
   <h1>等等。<br/>旅行怎麼會沒有代價？</h1>
   <div className="tm-finale-bill__ellipsis">本次花費<span>.</span><span>.</span><span>.</span></div>
   <p>翻遍口袋，竟然找不到這筆消費的收據。<br/>它甚至沒有標幣別。<br/>……我開始覺得事情不太單純了。</p>
   <button className="tm-finale__action" onClick={()=>next(5)}><LockKeyhole size={20}/>都到這裡了，拆開看看<ChevronRight size={18}/></button>
  </section>}
  {scene===5&&<section className="tm-finale-scene tm-finale-scene--cost">
   <p className="tm-finale__eyebrow">秘密帳本 · 這些還真的得親自還</p>
   <h1>原來這筆帳，<br/>要這樣還啊。</h1>
   <div className="tm-finale-cost__ledger"><JourneyLedger animated/></div>
   <p className="tm-finale__sub">糟糕，看來信用卡幫不上忙。<br/>只能等真正見面的時候，一筆一筆慢慢還了。</p>
   <button className="tm-finale__action" onClick={()=>next(6)}><BookOpenText size={20}/>好了好了，回來選旅行啦<ChevronRight size={18}/></button>
  </section>}
  {scene===6&&<section className="tm-finale-scene--routes">
   <div className="tm-finale-routes__heading"><p className="tm-finale__eyebrow">最終篇 · 走進六條岔路</p><h1>山海都在遠方，<br/>我們還有一天可以一起去。</h1><p>兩份結果都看過了。這一次，挑選自己真正想去的地方吧。</p></div>
   <details className="tm-finale__scores-all" open>
    <summary>六條路線 · 直選與推算的完整對照</summary>
    <div className="tm-finale-compare-table">
     <div className="tm-finale-compare-table__head"><span>路線</span><span>直選</span><span>偏好推算</span></div>
     {matches.map(m=><details key={m.id} className="tm-finale-compare-table__route">
      <summary><strong>{m.id} · {ROUTES[m.id].name}</strong><b>{m.directScore.toFixed(1)}</b><b>{m.preferenceScore.toFixed(1)}</b></summary>
      <div className="tm-finale-compare-table__people">
       <p>彥禎：直選 {m.people.yanzhen.direct.toFixed(1)} ／ 推算 {m.people.yanzhen.preference.toFixed(1)}</p>
       <p>涵郁：直選 {m.people.hanyu.direct.toFixed(1)} ／ 推算 {m.people.hanyu.preference.toFixed(1)}</p>
       {m.alerts.length>0&&<p>旅行提醒：{m.alerts.join("、")}</p>}
      </div>
     </details>)}
    </div>
    <p className="tm-finale__sub tm-finale__sub--small">兩套分數互不加權。點開每條路線可查看個人分數和實際行程條件提醒。</p>
   </details>
   {children}
   <button type="button" className="tm-finale__restart" onClick={()=>next(0)}><Sparkles size={15}/>好啦，我就是想再揭曉一次</button>
  </section>}
 </div>;
}
